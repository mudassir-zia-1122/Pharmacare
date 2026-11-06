import { query, withTransaction } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { logAudit } from './audit.service.js';
import { allocateBatchesFEFO } from './inventory.service.js';
import { calculateCheckoutTotals } from '../utils/decimalMath.js';

/**
 * POS Medicine Search by Barcode or Keyword.
 * Matches primary barcode, secondary barcodes, generic name, or brand name.
 */
export async function searchMedicinesForPOS(queryTerm) {
  if (!queryTerm || !queryTerm.trim()) return [];

  const term = `%${queryTerm.trim()}%`;
  const exactBarcode = queryTerm.trim();

  const sql = `
    SELECT m.id, m.generic_name AS genericName, m.brand_name AS brandName,
           m.strength, m.strength_unit AS strengthUnit, m.barcode,
           m.requires_prescription AS requiresPrescription,
           df.name AS dosageForm, c.name AS category,
           COALESCE(tr.rate_percent, 0.00) AS taxRate,
           COALESCE((
             SELECT SUM(b.quantity_on_hand)
               FROM batches b
              WHERE b.medicine_id = m.id AND b.status = 'active' AND b.expiry_date > CURRENT_DATE
           ), 0) AS stock,
           COALESCE((
             SELECT b.selling_price
               FROM batches b
              WHERE b.medicine_id = m.id AND b.status = 'active' AND b.expiry_date > CURRENT_DATE
              ORDER BY b.expiry_date ASC
              LIMIT 1
           ), 0.00) AS activePrice
      FROM medicines m
      JOIN dosage_forms df ON m.dosage_form_id = df.id
      JOIN categories c ON m.category_id = c.id
      LEFT JOIN tax_rules tr ON m.tax_rule_id = tr.id
     WHERE m.status = 'active'
       AND m.deleted_at IS NULL
       AND (
         m.barcode = ?
         OR EXISTS (SELECT 1 FROM medicine_barcodes mb WHERE mb.medicine_id = m.id AND mb.barcode = ?)
         OR m.generic_name LIKE ?
         OR m.brand_name LIKE ?
       )
     ORDER BY (m.barcode = ?) DESC, m.generic_name ASC
     LIMIT 10
  `;

  return query(sql, [exactBarcode, exactBarcode, term, term, exactBarcode]);
}

/**
 * Complete Point of Sale (POS) Checkout Transaction.
 *
 * Guarantees:
 * 1. Automatic FEFO batch selection.
 * 2. Complete server-side decimal math (subtotal, taxes, discounts).
 * 3. Prevention of dispensing expired/recalled batches.
 * 4. Atomic database transaction ensuring consistency across sales, items, batches, and movements.
 */
export async function processPOSCheckout(checkoutData, cashierUserId) {
  const {
    customerId = null,
    items, // Array of { medicineId, quantity, customDiscount }
    invoiceDiscount = 0,
    prescriptionId = null,
    prescriptionVerified = false,
    paymentMethod = 'cash',
    transactionReference = null,
    notes = null,
  } = checkoutData;

  if (!items || items.length === 0) {
    throw ApiError.badRequest('Checkout requires at least one medicine item');
  }

  return withTransaction(async (conn) => {
    // 1. Fetch system settings for tax toggle and default currency
    const [settingsRows] = await conn.execute(
      'SELECT setting_key, setting_value FROM pharmacy_settings WHERE setting_key IN ("tax_enabled", "currency_code")'
    );
    const settingsMap = Object.fromEntries(settingsRows.map(r => [r.setting_key, r.setting_value]));
    const taxEnabled = settingsMap.tax_enabled === 'true';
    const currencyCode = settingsMap.currency_code || 'PKR';

    // 2. Resolve items with live prices and FEFO batch allocations
    const itemsToCalculate = [];
    const batchDeductions = [];
    let hasPrescriptionRequired = false;

    for (const reqItem of items) {
      const { medicineId, quantity, customDiscount = 0 } = reqItem;
      const qty = parseInt(quantity, 10);
      if (!qty || qty <= 0) {
        throw ApiError.badRequest(`Invalid quantity specified: ${quantity}`);
      }

      // Check medicine details and prescription rule
      const [medRows] = await conn.execute(
        `SELECT m.id, m.generic_name, m.brand_name, m.requires_prescription,
                COALESCE(tr.rate_percent, 0.00) AS tax_rate
           FROM medicines m
           LEFT JOIN tax_rules tr ON m.tax_rule_id = tr.id
          WHERE m.id = ? AND m.status = 'active'`,
        [medicineId]
      );

      if (!medRows || medRows.length === 0) {
        throw ApiError.badRequest(`Medicine ID ${medicineId} not found or is discontinued`);
      }

      const med = medRows[0];
      if (med.requires_prescription) {
        hasPrescriptionRequired = true;
      }

      // Allocate batches using FEFO with row locking
      const allocatedBatches = await allocateBatchesFEFO(medicineId, qty, conn);

      for (const allocation of allocatedBatches) {
        itemsToCalculate.push({
          medicineId,
          batchId: allocation.batchId,
          batchNumber: allocation.batchNumber,
          quantity: allocation.allocateQuantity,
          unit_price: allocation.unitPrice,
          discount_amount: customDiscount,
          tax_rate: taxEnabled ? med.tax_rate : 0.00,
        });

        batchDeductions.push({
          batchId: allocation.batchId,
          quantity: allocation.allocateQuantity,
        });
      }
    }

    // Prescription validation check
    if (hasPrescriptionRequired && !prescriptionVerified && !prescriptionId) {
      throw ApiError.badRequest(
        'One or more items require a verified doctor prescription before checkout can proceed.'
      );
    }

    // 3. Compute accurate decimal totals on the server
    const { subtotal, discountTotal, taxTotal, netTotal, validatedItems } = calculateCheckoutTotals(
      itemsToCalculate,
      invoiceDiscount,
      taxEnabled
    );

    // 4. Generate unique invoice number: INV-YYYY-XXXXX
    const year = new Date().getFullYear();
    const [countRow] = await conn.execute(
      'SELECT COUNT(*) AS total FROM sales WHERE YEAR(created_at) = ?',
      [year]
    );
    const invoiceSeq = String(countRow[0].total + 1).padStart(5, '0');
    const invoiceNumber = `INV-${year}-${invoiceSeq}`;

    // 5. Insert sales invoice header
    const [saleResult] = await conn.execute(
      `INSERT INTO sales (
         invoice_number, customer_id, currency_code, subtotal_amount,
         discount_amount, tax_amount, total_amount, payment_status,
         status, has_prescription_items, prescription_id,
         cashier_user_id, notes
       ) VALUES (?, ?, ?, ?, ?, ?, ?, 'paid', 'completed', ?, ?, ?, ?)`,
      [
        invoiceNumber, customerId || null, currencyCode, subtotal,
        discountTotal, taxTotal, netTotal,
        hasPrescriptionRequired ? 1 : 0, prescriptionId || null,
        cashierUserId, notes || null,
      ]
    );

    const saleId = saleResult.insertId;

    // 6. Insert line items, deduct batch stock, and record movement ledger (Application-level atomic execution)
    for (const item of validatedItems) {
      // Re-verify batch state and lock row inside the transaction
      const [batchRows] = await conn.execute(
        `SELECT id, quantity_on_hand, status, expiry_date
           FROM batches
          WHERE id = ? FOR UPDATE`,
        [item.batchId]
      );

      if (!batchRows || batchRows.length === 0) {
        throw ApiError.badRequest(`Batch ID ${item.batchId} not found`);
      }

      const currentBatch = batchRows[0];
      if (currentBatch.status !== 'active') {
        throw ApiError.badRequest(
          `Cannot dispense from batch ${item.batchNumber || item.batchId}: batch is ${currentBatch.status}`
        );
      }

      if (new Date(currentBatch.expiry_date) <= new Date()) {
        throw ApiError.badRequest(
          `Cannot dispense from expired batch ${item.batchNumber || item.batchId} (expired ${currentBatch.expiry_date})`
        );
      }

      if (currentBatch.quantity_on_hand < item.quantity) {
        throw ApiError.badRequest(
          `Insufficient stock in batch ${item.batchNumber || item.batchId}. Available: ${currentBatch.quantity_on_hand}, Requested: ${item.quantity}`
        );
      }

      const previousQty = currentBatch.quantity_on_hand;
      const newQty = previousQty - item.quantity;
      const newStatus = newQty === 0 ? 'exhausted' : currentBatch.status;

      // Conditional atomic update preventing negative stock or concurrent modification
      const [deductResult] = await conn.execute(
        `UPDATE batches
            SET quantity_on_hand = ?,
                status = ?
          WHERE id = ?
            AND quantity_on_hand >= ?
            AND status = 'active'
            AND expiry_date > CURRENT_DATE`,
        [newQty, newStatus, item.batchId, item.quantity]
      );

      if (deductResult.affectedRows === 0) {
        throw ApiError.badRequest(
          `Failed to deduct inventory for batch ${item.batchNumber || item.batchId}: concurrent conflict or invalid batch state`
        );
      }

      // Insert line item
      await conn.execute(
        `INSERT INTO sale_items (
           sale_id, batch_id, medicine_id, quantity, unit_price,
           discount_amount, tax_rate, tax_amount, line_total
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          saleId, item.batchId, item.medicineId, item.quantity,
          item.unit_price, item.discount_amount, item.tax_rate,
          item.tax_amount, item.line_total,
        ]
      );

      // Record immutable stock movement ledger entry
      await conn.execute(
        `INSERT INTO stock_movements (
           batch_id, movement_type, quantity_change, previous_quantity,
           new_quantity, reference_type, reference_id, reason, performed_by_user_id
         ) VALUES (?, 'SALE_DISPENSE', ?, ?, ?, 'sale', ?, 'POS Dispense', ?)`,
        [
          item.batchId,
          -item.quantity,
          previousQty,
          newQty,
          invoiceNumber,
          cashierUserId || null,
        ]
      );
    }

    // 7. Insert payment record
    await conn.execute(
      `INSERT INTO payments (
         sale_id, payment_method, amount, currency_code,
         transaction_reference, received_by_user_id
       ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        saleId, paymentMethod, netTotal, currencyCode,
        transactionReference || null, cashierUserId,
      ]
    );

    // 8. Audit log inside the active transaction
    await logAudit({
      userId: cashierUserId,
      action: 'CREATE',
      tableName: 'sales',
      recordId: saleId,
      newValues: { invoiceNumber, total: netTotal, itemsCount: validatedItems.length },
      connection: conn,
    });

    return {
      saleId,
      invoiceNumber,
      subtotal,
      discount: discountTotal,
      tax: taxTotal,
      total: netTotal,
      currency: currencyCode,
      items: validatedItems,
    };
  });
}

/**
 * Get sales history with filtering and pagination.
 */
export async function getSalesHistory({ search, status, page = 1, limit = 20 }) {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
  const offsetNum = (pageNum - 1) * limitNum;
  const whereClauses = [];
  const params = [];

  if (search) {
    whereClauses.push('(s.invoice_number LIKE ? OR c.name LIKE ?)');
    const term = `%${search}%`;
    params.push(term, term);
  }

  if (status) {
    whereClauses.push('s.status = ?');
    params.push(status);
  }

  const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const countSql = `
    SELECT COUNT(*) AS total
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
    ${whereSql}
  `;
  const countRows = await query(countSql, params);
  const totalItems = countRows[0]?.total || 0;

  const dataSql = `
    SELECT s.id, s.invoice_number AS invoiceNumber, s.sale_timestamp AS saleDate,
           s.subtotal_amount AS subtotal, s.discount_amount AS discount,
           s.tax_amount AS tax, s.total_amount AS total, s.status,
           COALESCE(c.name, 'Walk-in') AS customer,
           u.full_name AS cashier,
           (SELECT COUNT(*) FROM sale_items si WHERE si.sale_id = s.id) AS itemCount
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      LEFT JOIN users u ON s.cashier_user_id = u.id
    ${whereSql}
     ORDER BY s.sale_timestamp DESC, s.id DESC
     LIMIT ? OFFSET ?
  `;
  const dataRows = await query(dataSql, [...params, limitNum, offsetNum]);

  return {
    items: dataRows,
    pagination: {
      page: pageNum,
      limit: limitNum,
      totalItems,
      totalPages: Math.ceil(totalItems / limitNum) || 1,
    },
  };
}

/**
 * Get complete invoice details for receipt printing.
 */
export async function getSaleInvoiceDetails(saleId) {
  const sales = await query(
    `SELECT s.*, COALESCE(c.name, 'Walk-in') AS customer_name,
            u.full_name AS cashier_name
       FROM sales s
       LEFT JOIN customers c ON s.customer_id = c.id
       JOIN users u ON s.cashier_user_id = u.id
      WHERE s.id = ? OR s.invoice_number = ?`,
    [saleId, saleId]
  );

  if (!sales || sales.length === 0) {
    throw ApiError.notFound(`Invoice not found with ID or invoice number ${saleId}`);
  }

  const sale = sales[0];

  const items = await query(
    `SELECT si.*, m.generic_name, m.brand_name, m.strength, m.strength_unit,
            b.batch_number, b.expiry_date
       FROM sale_items si
       JOIN medicines m ON si.medicine_id = m.id
       JOIN batches b ON si.batch_id = b.id
      WHERE si.sale_id = ?`,
    [sale.id]
  );

  const payments = await query('SELECT * FROM payments WHERE sale_id = ?', [sale.id]);

  return {
    ...sale,
    items,
    payments,
  };
}

export default {
  searchMedicinesForPOS,
  processPOSCheckout,
  getSalesHistory,
  getSaleInvoiceDetails,
};
