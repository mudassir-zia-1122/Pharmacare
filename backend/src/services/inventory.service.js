import { query, withTransaction } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { logAudit } from './audit.service.js';
import { BATCH_STATUS } from '../config/constants.js';

/**
 * Core FEFO (First Expired, First Out) Batch Allocation Algorithm.
 * Resolves batches for a dispensing request strictly in ascending order of expiry date.
 * Excludes expired, recalled, or quarantined batches.
 *
 * @param {number} medicineId
 * @param {number} requestedQuantity
 * @param {object} connection - Optional database transaction connection for row locking
 * @returns {Promise<Array<{batchId: number, batchNumber: string, expiryDate: string, unitPrice: number, allocateQuantity: number}>>}
 */
export async function allocateBatchesFEFO(medicineId, requestedQuantity, connection = null) {
  const runner = connection ? connection : { query: (sql, params) => query(sql, params) };

  // Note: FOR UPDATE locks rows inside a transaction to prevent race conditions during high-volume dispensing
  const lockClause = connection ? 'FOR UPDATE' : '';

  const sql = `
    SELECT id, batch_number, expiry_date, quantity_on_hand, selling_price, status
      FROM batches
     WHERE medicine_id = ?
       AND status = 'active'
       AND expiry_date > CURRENT_DATE
       AND quantity_on_hand > 0
     ORDER BY expiry_date ASC
     ${lockClause}
  `;

  const [batches] = connection ? await connection.execute(sql, [medicineId]) : [await query(sql, [medicineId])];

  if (!batches || batches.length === 0) {
    throw ApiError.badRequest(
      `No active, unexpired stock available for medicine ID ${medicineId}`
    );
  }

  let remaining = parseInt(requestedQuantity, 10);
  const allocations = [];

  for (const batch of batches) {
    if (remaining <= 0) break;

    const availableInBatch = batch.quantity_on_hand;
    const allocateFromThis = Math.min(availableInBatch, remaining);

    allocations.push({
      batchId: batch.id,
      batchNumber: batch.batch_number,
      expiryDate: batch.expiry_date,
      unitPrice: parseFloat(batch.selling_price),
      allocateQuantity: allocateFromThis,
    });

    remaining -= allocateFromThis;
  }

  if (remaining > 0) {
    const totalAvailable = batches.reduce((sum, b) => sum + b.quantity_on_hand, 0);
    throw ApiError.badRequest(
      `Insufficient stock. Requested: ${requestedQuantity}, Available active stock: ${totalAvailable}`
    );
  }

  return allocations;
}

/**
 * Get batch inventory list with search and status filtering.
 */
export async function getBatches({ search, status, page = 1, limit = 20 }) {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
  const offsetNum = (pageNum - 1) * limitNum;
  const whereClauses = [];
  const params = [];

  if (search) {
    whereClauses.push('(b.batch_number LIKE ? OR m.generic_name LIKE ? OR m.brand_name LIKE ?)');
    const term = `%${search}%`;
    params.push(term, term, term);
  }

  if (status) {
    whereClauses.push('b.status = ?');
    params.push(status);
  }

  const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const countSql = `
    SELECT COUNT(*) AS total
      FROM batches b
      JOIN medicines m ON b.medicine_id = m.id
    ${whereSql}
  `;
  const countRows = await query(countSql, params);
  const totalItems = countRows[0]?.total || 0;

  const dataSql = `
    SELECT b.id, b.batch_number AS batchNo, b.manufacturing_date AS mfgDate,
           b.expiry_date AS expiryDate, b.quantity_on_hand AS qty,
           b.cost_price AS costPrice, b.selling_price AS sellingPrice,
           b.status, b.quarantine_reason AS quarantineReason,
           CONCAT(m.generic_name, ' ', m.strength, m.strength_unit, ' (', m.brand_name, ')') AS medicine,
           COALESCE(s.name, 'Direct Supply') AS supplier
      FROM batches b
      JOIN medicines m ON b.medicine_id = m.id
      LEFT JOIN suppliers s ON b.supplier_id = s.id
    ${whereSql}
     ORDER BY b.expiry_date ASC
     LIMIT ? OFFSET ?
  `;
  const dataRows = await query(dataSql, [...params, limitNum, offsetNum]);

  // Aggregate summary counts
  const [activeCountRows, expiredCountRows, recalledCountRows] = await Promise.all([
    query('SELECT COUNT(*) AS count FROM batches WHERE status = "active"'),
    query('SELECT COUNT(*) AS count FROM batches WHERE status = "expired" OR (status = "active" AND expiry_date <= CURRENT_DATE)'),
    query('SELECT COUNT(*) AS count FROM batches WHERE status = "recalled" OR status = "quarantined"'),
  ]);

  return {
    items: dataRows,
    summary: {
      activeBatches: activeCountRows[0]?.count || 0,
      expiredBatches: expiredCountRows[0]?.count || 0,
      recalledBatches: recalledCountRows[0]?.count || 0,
    },
    pagination: {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      totalItems,
    },
  };
}

/**
 * Quarantine or recall a batch for pharmacy safety.
 * Immediately blocks all dispensing of this batch across the entire system.
 */
export async function updateBatchStatus(batchId, { status, reason }, userId) {
  if (![BATCH_STATUS.QUARANTINED, BATCH_STATUS.RECALLED, BATCH_STATUS.ACTIVE].includes(status)) {
    throw ApiError.badRequest(`Invalid batch status: ${status}`);
  }

  const existing = await query('SELECT * FROM batches WHERE id = ?', [batchId]);
  if (!existing || existing.length === 0) {
    throw ApiError.notFound(`Batch not found with ID ${batchId}`);
  }

  await query(
    'UPDATE batches SET status = ?, quarantine_reason = ? WHERE id = ?',
    [status, reason || null, batchId]
  );

  await logAudit({
    userId,
    action: 'STATUS_CHANGE',
    tableName: 'batches',
    recordId: batchId,
    oldValues: { status: existing[0].status },
    newValues: { status, reason },
  });

  return { message: `Batch ${existing[0].batch_number} status updated to ${status}` };
}

/**
 * Stock Movements ledger report.
 */
export async function getStockMovements({ batchId, movementType, limit = 50 }) {
  const limitNum = Math.max(1, Math.min(200, parseInt(limit, 10) || 50));
  const whereClauses = [];
  const params = [];

  if (batchId) {
    whereClauses.push('sm.batch_id = ?');
    params.push(batchId);
  }

  if (movementType) {
    whereClauses.push('sm.movement_type = ?');
    params.push(movementType);
  }

  const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

  return query(
    `SELECT sm.id, sm.batch_id AS batchId, sm.movement_type AS movementType,
            sm.quantity_change AS quantityChange, sm.previous_quantity AS prevQty,
            sm.new_quantity AS newQty, sm.reference_type AS refType,
            sm.reference_id AS refId, sm.reason, sm.created_at AS timestamp,
            b.batch_number AS batchNumber, m.generic_name AS genericName,
            COALESCE(u.full_name, 'System') AS performedBy
       FROM stock_movements sm
       JOIN batches b ON sm.batch_id = b.id
       JOIN medicines m ON b.medicine_id = m.id
       LEFT JOIN users u ON sm.performed_by_user_id = u.id
      ${whereSql}
      ORDER BY sm.created_at DESC
      LIMIT ?`,
    [...params, limitNum]
  );
}

export async function createBatch(data, userId) {
  const {
    medicineId, batchNumber, supplierId, manufacturingDate,
    expiryDate, quantity, costPrice, sellingPrice,
  } = data;

  if (!medicineId || !batchNumber || !expiryDate || !quantity || !costPrice || !sellingPrice) {
    throw ApiError.badRequest('Medicine, batch number, expiry date, quantity, cost price, and selling price are required');
  }

  if (new Date(expiryDate) <= new Date()) {
    throw ApiError.badRequest('Cannot receive already expired batch into active inventory');
  }

  if (parseInt(quantity, 10) <= 0) {
    throw ApiError.badRequest('Initial batch quantity must be positive');
  }

  return withTransaction(async (conn) => {
    const [existing] = await conn.execute(
      'SELECT id FROM batches WHERE medicine_id = ? AND batch_number = ? LIMIT 1',
      [medicineId, batchNumber.trim()]
    );
    if (existing && existing.length > 0) {
      throw ApiError.conflict(`Batch number "${batchNumber}" already exists for this medicine`);
    }

    const [insertRes] = await conn.execute(
      `INSERT INTO batches
       (medicine_id, batch_number, supplier_id, manufacturing_date, expiry_date,
        initial_quantity, quantity_on_hand, cost_price, selling_price, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [
        medicineId, batchNumber.trim(), supplierId || null,
        manufacturingDate || null, expiryDate,
        quantity, quantity, costPrice, sellingPrice
      ]
    );

    const batchId = insertRes.insertId;

    await conn.execute(
      `INSERT INTO stock_movements
       (batch_id, movement_type, quantity_change, previous_quantity, new_quantity, reference_type, reference_id, reason, performed_by_user_id)
       VALUES (?, 'PURCHASE_RECEIPT', ?, 0, ?, 'BATCH_INITIAL', ?, 'Initial batch receiving', ?)`,
      [batchId, quantity, quantity, batchNumber.trim(), userId]
    );

    return { id: batchId, batchNumber, quantity, status: 'active' };
  });
}

export async function adjustStock(batchId, { newQuantity, reason, movementType = 'AUDIT_ADJUSTMENT' }, userId) {
  if (newQuantity === undefined || newQuantity === null || parseInt(newQuantity, 10) < 0) {
    throw ApiError.badRequest('Valid non-negative new quantity is required');
  }

  if (!reason || !reason.trim()) {
    throw ApiError.badRequest('Mandatory justification reason is required for stock adjustments');
  }

  return withTransaction(async (conn) => {
    const [batches] = await conn.execute(
      'SELECT id, batch_number, quantity_on_hand, status, expiry_date FROM batches WHERE id = ? FOR UPDATE',
      [batchId]
    );

    if (!batches || batches.length === 0) {
      throw ApiError.notFound(`Batch ID ${batchId} not found`);
    }

    const batch = batches[0];
    const prevQty = batch.quantity_on_hand;
    const targetQty = parseInt(newQuantity, 10);
    const delta = targetQty - prevQty;

    if (delta === 0) {
      return { message: 'Quantity is already at target value', currentQuantity: prevQty };
    }

    if (targetQty < 0) {
      throw ApiError.badRequest('Stock quantity cannot be negative');
    }

    let updatedStatus = batch.status;
    if (targetQty === 0 && batch.status === 'active') {
      updatedStatus = 'exhausted';
    } else if (targetQty > 0 && batch.status === 'exhausted') {
      updatedStatus = new Date(batch.expiry_date) <= new Date() ? 'expired' : 'active';
    }

    await conn.execute(
      'UPDATE batches SET quantity_on_hand = ?, status = ? WHERE id = ?',
      [targetQty, updatedStatus, batchId]
    );

    await conn.execute(
      `INSERT INTO stock_movements
       (batch_id, movement_type, quantity_change, previous_quantity, new_quantity, reference_type, reference_id, reason, performed_by_user_id)
       VALUES (?, ?, ?, ?, ?, 'STOCK_ADJUSTMENT', ?, ?, ?)`,
      [batchId, movementType, delta, prevQty, targetQty, `ADJ-${batchId}-${Date.now()}`, reason.trim(), userId]
    );

    return {
      batchId,
      batchNumber: batch.batch_number,
      previousQuantity: prevQty,
      newQuantity: targetQty,
      quantityChange: delta,
      status: updatedStatus,
    };
  });
}

export async function disposeExpiredBatch(batchId, { reason }, userId) {
  if (!reason || !reason.trim()) {
    throw ApiError.badRequest('Disposal reason and regulatory justification are mandatory');
  }

  return withTransaction(async (conn) => {
    const [batches] = await conn.execute(
      'SELECT id, batch_number, quantity_on_hand, status, expiry_date FROM batches WHERE id = ? FOR UPDATE',
      [batchId]
    );

    if (!batches || batches.length === 0) {
      throw ApiError.notFound(`Batch ID ${batchId} not found`);
    }

    const batch = batches[0];
    const prevQty = batch.quantity_on_hand;

    if (prevQty <= 0) {
      throw ApiError.badRequest('Batch has zero remaining stock to dispose');
    }

    await conn.execute(
      'UPDATE batches SET quantity_on_hand = 0, status = "exhausted", quarantine_reason = ? WHERE id = ?',
      [`DISPOSED: ${reason.trim()}`, batchId]
    );

    await conn.execute(
      `INSERT INTO stock_movements
       (batch_id, movement_type, quantity_change, previous_quantity, new_quantity, reference_type, reference_id, reason, performed_by_user_id)
       VALUES (?, 'EXPIRED_WRITE_OFF', ?, ?, 0, 'DISPOSAL_ACT', ?, ?, ?)`,
      [batchId, -prevQty, prevQty, `DISP-${batchId}-${Date.now()}`, reason.trim(), userId]
    );

    return {
      batchId,
      batchNumber: batch.batch_number,
      disposedQuantity: prevQty,
      reason: reason.trim(),
    };
  });
}

export async function getExpiryAlerts(days = 90) {
  const windowDays = parseInt(days, 10) || 90;

  const [expiredBatches, nearExpiryBatches] = await Promise.all([
    query(`
      SELECT b.id, b.batch_number AS batchNumber, b.expiry_date AS expiryDate,
             b.quantity_on_hand AS quantity, b.cost_price AS costPrice,
             b.selling_price AS sellingPrice, b.status,
             m.generic_name AS genericName, m.brand_name AS brandName,
             m.strength, df.name AS dosageForm,
             DATEDIFF(CURRENT_DATE, b.expiry_date) AS daysPastExpiry
        FROM batches b
        JOIN medicines m ON b.medicine_id = m.id
        JOIN dosage_forms df ON m.dosage_form_id = df.id
       WHERE (b.expiry_date <= CURRENT_DATE OR b.status = 'expired')
         AND b.quantity_on_hand > 0
       ORDER BY b.expiry_date ASC
    `),
    query(`
      SELECT b.id, b.batch_number AS batchNumber, b.expiry_date AS expiryDate,
             b.quantity_on_hand AS quantity, b.cost_price AS costPrice,
             b.selling_price AS sellingPrice, b.status,
             m.generic_name AS genericName, m.brand_name AS brandName,
             m.strength, df.name AS dosageForm,
             DATEDIFF(b.expiry_date, CURRENT_DATE) AS daysUntilExpiry
        FROM batches b
        JOIN medicines m ON b.medicine_id = m.id
        JOIN dosage_forms df ON m.dosage_form_id = df.id
       WHERE b.expiry_date > CURRENT_DATE
         AND b.expiry_date <= DATE_ADD(CURRENT_DATE, INTERVAL ? DAY)
         AND b.quantity_on_hand > 0
         AND b.status = 'active'
       ORDER BY b.expiry_date ASC
    `, [windowDays]),
  ]);

  const within30 = nearExpiryBatches.filter(b => b.daysUntilExpiry <= 30);
  const within60 = nearExpiryBatches.filter(b => b.daysUntilExpiry > 30 && b.daysUntilExpiry <= 60);
  const within90 = nearExpiryBatches.filter(b => b.daysUntilExpiry > 60 && b.daysUntilExpiry <= 90);

  return {
    windowDays,
    expiredCount: expiredBatches.length,
    nearExpiryCount: nearExpiryBatches.length,
    buckets: {
      expired: expiredBatches,
      within30,
      within60,
      within90,
    },
  };
}

export async function getInventoryReports() {
  const [
    valuationRows,
    lowStockRows,
    outOfStockRows,
    expiredRows,
  ] = await Promise.all([
    query(`
      SELECT
        COALESCE(SUM(CASE WHEN b.status = 'active' AND b.expiry_date > CURRENT_DATE THEN b.cost_price * b.quantity_on_hand ELSE 0 END), 0) AS saleableValuation,
        COALESCE(SUM(CASE WHEN b.status != 'active' OR b.expiry_date <= CURRENT_DATE THEN b.cost_price * b.quantity_on_hand ELSE 0 END), 0) AS blockedValuation,
        COALESCE(SUM(CASE WHEN b.status = 'active' AND b.expiry_date > CURRENT_DATE THEN b.quantity_on_hand ELSE 0 END), 0) AS saleableUnits,
        COALESCE(SUM(CASE WHEN b.status != 'active' OR b.expiry_date <= CURRENT_DATE THEN b.quantity_on_hand ELSE 0 END), 0) AS blockedUnits
      FROM batches b
    `),
    query(`
      SELECT m.id, m.generic_name AS genericName, m.brand_name AS brandName,
             m.strength, m.reorder_level AS reorderLevel, df.name AS dosageForm,
             COALESCE(SUM(b.quantity_on_hand), 0) AS currentStock
        FROM medicines m
        JOIN dosage_forms df ON m.dosage_form_id = df.id
        LEFT JOIN batches b ON m.id = b.medicine_id AND b.status = 'active' AND b.expiry_date > CURRENT_DATE
       WHERE m.deleted_at IS NULL AND m.status = 'active'
       GROUP BY m.id, m.generic_name, m.brand_name, m.strength, m.reorder_level, df.name
      HAVING currentStock > 0 AND currentStock <= m.reorder_level
       ORDER BY currentStock ASC
    `),
    query(`
      SELECT m.id, m.generic_name AS genericName, m.brand_name AS brandName,
             m.strength, m.reorder_level AS reorderLevel, df.name AS dosageForm
        FROM medicines m
        JOIN dosage_forms df ON m.dosage_form_id = df.id
       WHERE m.deleted_at IS NULL AND m.status = 'active'
         AND NOT EXISTS (
           SELECT 1 FROM batches b
            WHERE b.medicine_id = m.id AND b.status = 'active' AND b.expiry_date > CURRENT_DATE AND b.quantity_on_hand > 0
         )
       ORDER BY m.generic_name ASC
    `),
    query(`
      SELECT b.id, b.batch_number AS batchNumber, b.expiry_date AS expiryDate,
             b.quantity_on_hand AS quantity, b.cost_price AS costPrice,
             m.generic_name AS genericName, m.brand_name AS brandName,
             DATEDIFF(CURRENT_DATE, b.expiry_date) AS daysPastExpiry
        FROM batches b
        JOIN medicines m ON b.medicine_id = m.id
       WHERE (b.expiry_date <= CURRENT_DATE OR b.status = 'expired')
         AND b.quantity_on_hand > 0
       ORDER BY b.expiry_date ASC
    `),
  ]);

  return {
    valuation: {
      saleableCost: parseFloat(valuationRows[0]?.saleableValuation || 0),
      blockedCost: parseFloat(valuationRows[0]?.blockedValuation || 0),
      saleableUnits: parseInt(valuationRows[0]?.saleableUnits || 0, 10),
      blockedUnits: parseInt(valuationRows[0]?.blockedUnits || 0, 10),
    },
    lowStock: lowStockRows,
    outOfStock: outOfStockRows,
    expiredStock: expiredRows,
  };
}

export default {
  allocateBatchesFEFO,
  getBatches,
  createBatch,
  updateBatchStatus,
  adjustStock,
  disposeExpiredBatch,
  getExpiryAlerts,
  getInventoryReports,
  getStockMovements,
};
