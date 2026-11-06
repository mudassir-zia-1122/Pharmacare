import { query } from '../config/db.js';

export async function getNotifications({ unreadOnly = false, limit = 20, userId } = {}) {
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));

  const whereClauses = [];
  const params = [];

  if (userId) {
    whereClauses.push('(user_id IS NULL OR user_id = ?)');
    params.push(parseInt(userId, 10));
  } else {
    whereClauses.push('user_id IS NULL');
  }

  if (unreadOnly) {
    whereClauses.push('is_read = 0');
  }

  const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const sql = `
    SELECT id, user_id AS userId, type, title, message, link, is_read AS isRead, created_at AS createdAt
      FROM notifications
    ${whereSql}
     ORDER BY created_at DESC
     LIMIT ?
  `;
  const items = await query(sql, [...params, limitNum]);

  const countSql = `SELECT COUNT(*) AS unreadCount FROM notifications WHERE (user_id IS NULL ${userId ? 'OR user_id = ?' : ''}) AND is_read = 0`;
  const countParams = userId ? [parseInt(userId, 10)] : [];
  const [unreadRes] = await query(countSql, countParams);

  return {
    items,
    unreadCount: unreadRes?.unreadCount || 0,
  };
}

export async function getUnreadCount(userId) {
  const countSql = `SELECT COUNT(*) AS unreadCount FROM notifications WHERE (user_id IS NULL ${userId ? 'OR user_id = ?' : ''}) AND is_read = 0`;
  const countParams = userId ? [parseInt(userId, 10)] : [];
  const [res] = await query(countSql, countParams);
  return res?.unreadCount || 0;
}

export async function markAsRead(id) {
  await query('UPDATE notifications SET is_read = 1 WHERE id = ?', [id]);
  return { success: true, id };
}

export async function markAllAsRead(userId) {
  const sql = `UPDATE notifications SET is_read = 1 WHERE is_read = 0 ${userId ? 'AND (user_id IS NULL OR user_id = ?)' : 'AND user_id IS NULL'}`;
  const params = userId ? [parseInt(userId, 10)] : [];
  await query(sql, params);
  return { success: true };
}
