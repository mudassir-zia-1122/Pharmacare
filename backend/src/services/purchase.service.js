import { query, withTransaction } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { logAudit } from './audit.service.js';
import { roundCurrency, addMoney, multiplyLineTotal } from '../utils/decimalMath.js';
import { MOVEMENT_TYPES } from '../config/constants.js';

export async function getPurchaseOrders({ search, status, page = 1, limit = 20 }) {
  const offset = (page - 1) * limit;
  const whereClauses = [];
  const params = [];

  if (search) {
    whereClauses.push('(po.po_number LIKE ? OR s.name LIKE ?)');
    const term = `%${search}%`;
    params.push(term, term);
  }

  if (status) {
    whereClauses.push('po.status = ?');
    params.push(status);
  }

  const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const countSql = `
    SELECT COUNT(*) AS total
      FROM purchase_orders po
      JOIN suppliers s ON po.supplier_id = s.id
    ${whereSql}
  `;
  const countRows = await query(countSql, params);
  const totalItems = countRows[0]?.total || 0;

  const dataSql = `
    SELECT po.id, po.po_number AS poNumber, po.order_date AS orderDate,
           po.total_amount AS totalAmount, po.status, s.name AS supplier,
           COALESCE(u.full_name, 'Staff') AS createdBy,
           (SELECT COUNT(*) FROM purchase_order_items poi WHERE poi.purchase_order_id = po.id) AS itemCount
      FROM purchase_orders po
      JOIN suppliers s ON po.supplier_id = s.id
      JOIN users u ON po.created_by_user_id = u.id
    ${whereSql}
     ORDER BY po.order_date DESC, po.id DESC
     LIMIT ? OFFSET ?
  `;
  const dataRows = await query(dataSql, [...params, limit, offset]);

  return {
    items: dataRows,
    pagination: {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      totalItems,
    },
  };
}

export async function getPurchaseOrderById(id) {
  const poRows = await query(
    `SELECT po.*, s.name AS supplier_name, s.phone AS supplier_phone,
            u.full_name AS created_by_name
       FROM purchase_orders po
       JOIN suppliers s ON po.supplier_id = s.id
       JOIN users u ON po.created_by_user_id = u.id
      WHERE po.id = ? OR po.po_number = ?
      LIMIT 1`,
    [id, id]
  );

  if (!poRows || poRows.length === 0) {
    throw ApiError.notFound(`Purchase Order not found with ID: ${id}`);
  }

  const items = await query(
    `SELECT poi.*, m.generic_name, m.brand_name, m.strength, m.strength_unit
       FROM purchase_order_items poi
       JOIN medicines m ON poi.medicine_id = m.id
      WHERE poi.purchase_order_id = ?`,
    [poRows[0].id]
  );

  return {
    ...poRows[0],
    items,
  };
}

export async function createPurchaseOrder(data, userId) {
  const { supplierId, orderDate, supplierInvoiceNumber, items, notes } = data;

  if (!items || items.length === 0) {
    throw ApiError.badRequest('At least one purchase order item is required');
  }

  return withTransaction(async (conn) => {
    // Generate unique PO number: PO-YYYY-XXXXX
    const year = new Date().getFullYear();
    const [countRow] = await conn.execute(
      'SELECT COUNT(*) AS total FROM purchase_orders WHERE YEAR(created_at) = ?',
      [year]
    );
    const seq = String(countRow[0].total + 1).padStart(4, '0');
    const poNumber = `PO-${year}-${seq}`;

    let subtotal = 0.00;

    // Calculate line items
    const calculatedItems = items.map(item => {
      const qty = parseInt(item.orderedQuantity, 10) || 1;
      const cost = roundCurrency(item.unitCostPrice ?? item.unitCost ?? 0);
      const selling = roundCurrency(item.unitSellingPrice ?? item.sellingPrice ?? item.unitPrice ?? 0);
      const lineTotal = multiplyLineTotal(cost, qty);
      subtotal = addMoney(subtotal, lineTotal);

      return {
        ...item,
        orderedQuantity: qty,
        unitCostPrice: cost,
        unitSellingPrice: selling,
        lineTotal,
      };
    });

    const [poResult] = await conn.execute(
      `INSERT INTO purchase_orders (
         po_number, supplier_id, order_date, supplier_invoice_number,
         subtotal_amount, total_amount, status, notes, created_by_user_id
       ) VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?)`,
      [
        poNumber, supplierId, orderDate || new Date(),
        supplierInvoiceNumber || null, subtotal, subtotal,
        notes || null, userId,
      ]
    );

    const poId = poResult.insertId;

    for (const item of calculatedItems) {
      await conn.execute(
        `INSERT INTO purchase_order_items (
           purchase_order_id, medicine_id, batch_number,
           manufacturing_date, expiry_date, ordered_quantity,
           received_quantity, unit_cost_price, unit_selling_price, line_total
         ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
        [
          poId, item.medicineId, item.batchNumber,
          item.manufacturingDate || null, item.expiryDate || null,
          item.orderedQuantity, item.unitCostPrice,
          item.unitSellingPrice, item.lineTotal,
        ]
      );
    }

    await logAudit({
      userId,
      action: 'CREATE',
      tableName: 'purchase_orders',
      recordId: poId,
      newValues: { poNumber, totalAmount: subtotal },
      connection: conn,
    });

    return { id: poId, poNumber, totalAmount: subtotal };
  });
}

/**
 * Receives stock on a purchase order.
 * Updates inventory batches and creates immutable stock movements inside an atomic transaction.
 */
export async function receivePurchaseStock(purchaseOrderId, receivedItems, userId) {
  return withTransaction(async (conn) => {
    const [poRows] = await conn.execute(
      'SELECT id, po_number, supplier_id, status FROM purchase_orders WHERE id = ? OR po_number = ? FOR UPDATE',
      [purchaseOrderId, purchaseOrderId]
    );

    if (!poRows || poRows.length === 0) {
      throw ApiError.notFound('Purchase Order not found');
    }

    const po = poRows[0];
    const realPoId = po.id;
    if (po.status === 'received') {
      throw ApiError.badRequest('This purchase order has already been fully received');
    }

    for (const item of receivedItems) {
      const { poiId, receivedQty } = item;
      const qty = parseInt(receivedQty, 10);
      if (qty <= 0) continue;

      // Update purchase_order_items received count
      const [poiRows] = await conn.execute(
        'SELECT * FROM purchase_order_items WHERE id = ? AND purchase_order_id = ?',
        [poiId, realPoId]
      );

      if (!poiRows || poiRows.length === 0) {
        throw ApiError.badRequest(`Invalid line item ID ${poiId}`);
      }

      const poi = poiRows[0];
      await conn.execute(
        'UPDATE purchase_order_items SET received_quantity = received_quantity + ? WHERE id = ?',
        [qty, poiId]
      );

      // Check if batch already exists for this medicine and batch_number
      const [existingBatches] = await conn.execute(
        'SELECT id, quantity_on_hand FROM batches WHERE medicine_id = ? AND batch_number = ?',
        [poi.medicine_id, poi.batch_number]
      );

      let batchId;
      let prevQty = 0;
      let newQty = qty;

      if (existingBatches && existingBatches.length > 0) {
        batchId = existingBatches[0].id;
        prevQty = existingBatches[0].quantity_on_hand;
        newQty = prevQty + qty;

        await conn.execute(
          `UPDATE batches
              SET quantity_on_hand = ?,
                  cost_price = ?,
                  selling_price = ?,
                  status = 'active'
            WHERE id = ?`,
          [newQty, poi.unit_cost_price, poi.unit_selling_price, batchId]
        );
      } else {
        const [batchResult] = await conn.execute(
          `INSERT INTO batches (
             batch_number, medicine_id, supplier_id, manufacturing_date,
             expiry_date, initial_quantity, quantity_on_hand,
             cost_price, selling_price, status
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
          [
            poi.batch_number, poi.medicine_id, po.supplier_id,
            poi.manufacturing_date, poi.expiry_date, qty, qty,
            poi.unit_cost_price, poi.unit_selling_price,
          ]
        );
        batchId = batchResult.insertId;
      }

      // Record stock movement ledger entry
      await conn.execute(
        `INSERT INTO stock_movements (
           batch_id, movement_type, quantity_change, previous_quantity,
           new_quantity, reference_type, reference_id, reason, performed_by_user_id
         ) VALUES (?, ?, ?, ?, ?, 'purchase_order', ?, 'Received Purchase Delivery', ?)`,
        [
          batchId, MOVEMENT_TYPES.PURCHASE_RECEIPT, qty,
          prevQty, newQty, po.po_number, userId,
        ]
      );
    }

    // Update PO status to received
    await conn.execute(
      `UPDATE purchase_orders
          SET status = 'received', received_date = CURRENT_DATE
        WHERE id = ?`,
      [realPoId]
    );

    await logAudit({
      userId,
      action: 'UPDATE',
      tableName: 'purchase_orders',
      recordId: realPoId,
      newValues: { status: 'received' },
      connection: conn,
    });

    return { message: `Purchase order ${po.po_number} received into stock successfully` };
  });
}

export default {
  getPurchaseOrders,
  getPurchaseOrderById,
  createPurchaseOrder,
  receivePurchaseStock,
};
