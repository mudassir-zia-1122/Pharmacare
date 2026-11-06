import { query } from '../config/db.js';

export async function logAudit({
  userId,
  action,
  tableName,
  table,
  recordId,
  oldValues = null,
  newValues = null,
  details = null,
  ipAddress = null,
  userAgent = null,
  connection = null,
}) {
  try {
    const targetTable = tableName || table || 'general';
    const payloadNew = newValues || details || null;
    const validActions = ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'VIEW_SENSITIVE', 'STATUS_CHANGE', 'OVERRIDE'];
    let safeAction = typeof action === 'string' ? action.trim().toUpperCase() : 'CREATE';
    if (!validActions.includes(safeAction)) {
      if (safeAction.startsWith('CREATE')) safeAction = 'CREATE';
      else if (safeAction.startsWith('UPDATE')) safeAction = 'UPDATE';
      else if (safeAction.startsWith('DELETE')) safeAction = 'DELETE';
      else if (safeAction.startsWith('STATUS')) safeAction = 'STATUS_CHANGE';
      else if (safeAction.startsWith('VIEW')) safeAction = 'VIEW_SENSITIVE';
      else safeAction = 'CREATE';
    }
    const sql = `INSERT INTO audit_logs (
         user_id, action, table_name, record_id,
         old_values, new_values, ip_address, user_agent
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    const params = [
      userId || null,
      safeAction,
      targetTable,
      recordId ? String(recordId) : null,
      oldValues ? JSON.stringify(oldValues) : null,
      payloadNew ? JSON.stringify(payloadNew) : null,
      ipAddress || null,
      userAgent || null,
    ];

    if (connection && typeof connection.execute === 'function') {
      await connection.execute(sql, params);
    } else {
      await query(sql, params);
    }
  } catch (err) {
    // Audit failure should not crash primary transaction, but must be logged
    console.error('[AUDIT_ERROR] Failed to record audit log:', err.message);
  }
}

export default {
  logAudit,
};
