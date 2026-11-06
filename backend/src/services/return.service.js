import { query, withTransaction } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { logAudit } from './audit.service.js';
import { roundCurrency, addMoney, multiplyLineTotal } from '../utils/decimalMath.js';
import { MOVEMENT_TYPES, RESTOCK_ACTIONS } from '../config/constants.js';

export async function getReturns({ type, search, page = 1, limit = 20 }) {
  const offset = (page - 1) * limit;
  const whereClauses = [];
  const params = [];

  if (type) {
    whereClauses.push('r.return_type = ?');
    params.push(type);
  }

  if (search) {
    whereClauses.push('(r.return_number LIKE ? OR r.reason LIKE ?)');
    const term = `%${search}%`;
    params.push(term, term);
  }

  const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const countSql = `SELECT COUNT(*) AS total FROM returns r ${whereSql}`;
  const countRows = await query(countSql, params);
  const totalItems = countRows[0]?.total || 0;

  const dataSql = `
    SELECT r.id, r.return_number AS returnNumber, r.return_type AS returnType,
           r.return_date AS returnDate, r.total_refund_amount AS totalRefund,
           r.reason, r.status,
           COALESCE(s.invoice_number, po.po_number, 'N/A') AS reference,
           COALESCE(c.name, sup.name, 'Customer') AS entityName,
           u.full_name AS processedBy,
           (SELECT COUNT(*) FROM return_items ri WHERE ri.return_id = r.id) AS itemCount
      FROM returns r
      LEFT JOIN sales s ON r.reference_sale_id = s.id
      LEFT JOIN purchase_orders po ON r.reference_purchase_order_id = po.id
      LEFT JOIN customers c ON r.customer_id = c.id
      LEFT JOIN suppliers sup ON r.supplier_id = sup.id
      JOIN users u ON r.processed_by_user_id = u.id
    ${whereSql}
     ORDER BY r.return_date DESC, r.id DESC
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

/**
 * Process a customer sales return transactionally.
 * Validates quantity against the original sale, restores batch inventory if requested,
 * and audits all actions.
 */
export async function processSaleReturn(returnData, userId) {
  const { saleId, items, reason, notes } = returnData;

  if (!items || items.length === 0) {
    throw ApiError.badRequest('At least one return item must be specified');
  }

  return withTransaction(async (conn) => {
    // 1. Verify sale exists
    const [saleRows] = await conn.execute(
      'SELECT id, invoice_number, customer_id, status FROM sales WHERE id = ? OR invoice_number = ? FOR UPDATE',
      [saleId, saleId]
    );

    if (!saleRows || saleRows.length === 0) {
      throw ApiError.notFound(`Original sale invoice not found for ID or invoice ${saleId}`);
    }

    const sale = saleRows[0];
    const realSaleId = sale.id;

    // 2. Generate unique return number: RTN-YYYY-XXXXX
    const year = new Date().getFullYear();
    const [countRow] = await conn.execute(
      'SELECT COUNT(*) AS total FROM returns WHERE YEAR(created_at) = ?',
      [year]
    );
    const seq = String(countRow[0].total + 1).padStart(4, '0');
    const returnNumber = `RTN-${year}-${seq}`;

    let totalRefund = 0.00;

    // 3. Insert return ticket header
    const [returnResult] = await conn.execute(
      `INSERT INTO returns (
         return_number, return_type, reference_sale_id, customer_id,
         total_refund_amount, reason, status, processed_by_user_id, notes
       ) VALUES (?, 'SALE_RETURN', ?, ?, 0.00, ?, 'completed', ?, ?)`,
      [returnNumber, realSaleId, sale.customer_id, reason, userId, notes || null]
    );

    const returnId = returnResult.insertId;

    // 4. Validate and process line items
    for (const item of items) {
      const { saleItemId, returnQuantity, restockAction = RESTOCK_ACTIONS.RESTOCK_ACTIVE } = item;
      const qty = parseInt(returnQuantity, 10);
      if (qty <= 0) continue;

      // Lock and inspect original sale item
      const [siRows] = await conn.execute(
        'SELECT * FROM sale_items WHERE id = ? AND sale_id = ? FOR UPDATE',
        [saleItemId, realSaleId]
      );

      if (!siRows || siRows.length === 0) {
        throw ApiError.badRequest(`Sale item ${saleItemId} does not belong to invoice ${sale.invoice_number}`);
      }

      const saleItem = siRows[0];
      const maxReturnable = saleItem.quantity - saleItem.returned_quantity;

      if (qty > maxReturnable) {
        throw ApiError.badRequest(
          `Cannot return ${qty} units. Maximum returnable units on this line item is ${maxReturnable}`
        );
      }

      const unitRefund = roundCurrency(saleItem.unit_price);
      const lineRefund = multiplyLineTotal(unitRefund, qty);
      totalRefund = addMoney(totalRefund, lineRefund);

      // Update returned_quantity on the original sale item
      await conn.execute(
        'UPDATE sale_items SET returned_quantity = returned_quantity + ? WHERE id = ?',
        [qty, saleItemId]
      );

      // Insert return item record
      await conn.execute(
        `INSERT INTO return_items (
           return_id, sale_item_id, batch_id, medicine_id, quantity,
           unit_refund_price, total_refund, restock_action
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          returnId, saleItemId, saleItem.batch_id, saleItem.medicine_id,
          qty, unitRefund, lineRefund, restockAction,
        ]
      );

      // Restock inventory batch if action is RESTOCK_ACTIVE
      if (restockAction === RESTOCK_ACTIONS.RESTOCK_ACTIVE) {
        const [batchRows] = await conn.execute(
          'SELECT quantity_on_hand, expiry_date, status FROM batches WHERE id = ? FOR UPDATE',
          [saleItem.batch_id]
        );
        const batch = batchRows[0];
        const prevQty = batch?.quantity_on_hand || 0;
        const newQty = prevQty + qty;

        // Regulatory Pharmacy Safety: Verify batch has not expired or been recalled since original sale
        const isExpired = new Date(batch.expiry_date) <= new Date();
        const isRecalled = batch.status === 'recalled';

        let targetStatus = 'active';
        if (isExpired) {
          targetStatus = 'expired';
        } else if (isRecalled) {
          targetStatus = 'recalled';
        }

        await conn.execute(
          'UPDATE batches SET quantity_on_hand = ?, status = ? WHERE id = ?',
          [newQty, targetStatus, saleItem.batch_id]
        );

        // Record stock movement
        await conn.execute(
          `INSERT INTO stock_movements (
             batch_id, movement_type, quantity_change, previous_quantity,
             new_quantity, reference_type, reference_id, reason, performed_by_user_id
           ) VALUES (?, ?, ?, ?, ?, 'return', ?, ?, ?)`,
          [
            saleItem.batch_id, MOVEMENT_TYPES.SALE_RETURN, qty,
            prevQty, newQty, returnNumber,
            isExpired ? `Customer Return (BLOCKED: Batch Expired) - ${reason}` : reason,
            userId,
          ]
        );
      }
    }

    // 5. Update total refund amount on return header
    await conn.execute(
      'UPDATE returns SET total_refund_amount = ? WHERE id = ?',
      [totalRefund, returnId]
    );

    // 6. Update sale status
    await conn.execute(
      'UPDATE sales SET status = "partially_returned" WHERE id = ?',
      [saleId]
    );

    await logAudit({
      userId,
      action: 'CREATE',
      tableName: 'returns',
      recordId: returnId,
      newValues: { returnNumber, totalRefund, saleInvoice: sale.invoice_number },
      connection: conn,
    });

    return {
      returnId,
      returnNumber,
      totalRefund,
      message: `Return ${returnNumber} processed successfully`,
    };
  });
}

export default {
  getReturns,
  processSaleReturn,
};
