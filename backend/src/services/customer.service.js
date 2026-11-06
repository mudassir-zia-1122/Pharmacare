import { query } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { logAudit } from './audit.service.js';

export async function getCustomers({ search, page = 1, limit = 20 }) {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
  const offsetNum = (pageNum - 1) * limitNum;

  const whereClauses = ['deleted_at IS NULL'];
  const params = [];

  if (search && search.trim()) {
    whereClauses.push('(name LIKE ? OR phone LIKE ? OR email LIKE ? OR cnic_or_id LIKE ?)');
    const term = `%${search.trim()}%`;
    params.push(term, term, term, term);
  }

  const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const countSql = `SELECT COUNT(*) AS total FROM customers ${whereSql}`;
  const countRows = await query(countSql, params);
  const totalItems = countRows[0]?.total || 0;

  const dataSql = `
    SELECT id, name, phone, email, address, cnic_or_id AS cnic,
           is_tax_exempt AS isTaxExempt, notes,
           created_at AS createdAt, updated_at AS updatedAt,
           (SELECT COUNT(*) FROM sales WHERE customer_id = customers.id) AS totalOrders,
           (SELECT COALESCE(SUM(total_amount), 0) FROM sales WHERE customer_id = customers.id AND status = 'completed') AS totalSpent
      FROM customers
    ${whereSql}
     ORDER BY created_at DESC
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

export async function getCustomerById(id) {
  const rows = await query(
    `SELECT id, name, phone, email, address, cnic_or_id AS cnic,
            is_tax_exempt AS isTaxExempt, notes,
            created_at AS createdAt, updated_at AS updatedAt,
            (SELECT COUNT(*) FROM sales WHERE customer_id = customers.id) AS totalOrders,
            (SELECT COALESCE(SUM(total_amount), 0) FROM sales WHERE customer_id = customers.id AND status = 'completed') AS totalSpent
       FROM customers
      WHERE id = ? AND deleted_at IS NULL`,
    [id]
  );

  if (!rows || rows.length === 0) {
    throw ApiError.notFound('Customer not found');
  }

  // Also fetch customer's recent purchase history
  const salesRows = await query(
    `SELECT id, invoice_number AS invoiceNumber, total_amount AS total, status,
            sale_timestamp AS saleTimestamp
       FROM sales
      WHERE customer_id = ?
      ORDER BY sale_timestamp DESC
      LIMIT 10`,
    [id]
  );

  return {
    ...rows[0],
    recentOrders: salesRows || [],
  };
}

export async function createCustomer(data, userId) {
  const { name, phone, email, address, cnic, isTaxExempt = false, notes } = data;

  if (!name || !name.trim()) {
    throw ApiError.badRequest('Customer name is required');
  }

  // If phone provided, verify uniqueness among active records
  if (phone && phone.trim()) {
    const existing = await query(
      'SELECT id FROM customers WHERE phone = ? AND deleted_at IS NULL',
      [phone.trim()]
    );
    if (existing.length > 0) {
      throw ApiError.conflict(`Customer with phone number "${phone}" already exists`);
    }
  }

  const result = await query(
    `INSERT INTO customers (name, phone, email, address, cnic_or_id, is_tax_exempt, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      name.trim(),
      phone?.trim() || null,
      email?.trim() || null,
      address?.trim() || null,
      cnic?.trim() || null,
      isTaxExempt ? 1 : 0,
      notes?.trim() || null,
    ]
  );

  const newCustomerId = result.insertId;

  await logAudit({
    userId,
    action: 'CREATE',
    tableName: 'customers',
    recordId: newCustomerId,
    newValues: { name: name.trim(), phone: phone?.trim(), email: email?.trim() },
  });

  return getCustomerById(newCustomerId);
}

export async function updateCustomer(id, data, userId) {
  const customer = await getCustomerById(id);

  const { name, phone, email, address, cnic, isTaxExempt, notes } = data;

  if (!name || !name.trim()) {
    throw ApiError.badRequest('Customer name is required');
  }

  if (phone && phone.trim()) {
    const existing = await query(
      'SELECT id FROM customers WHERE phone = ? AND id != ? AND deleted_at IS NULL',
      [phone.trim(), id]
    );
    if (existing.length > 0) {
      throw ApiError.conflict(`Customer with phone number "${phone}" already exists`);
    }
  }

  await query(
    `UPDATE customers
        SET name = ?,
            phone = ?,
            email = ?,
            address = ?,
            cnic_or_id = ?,
            is_tax_exempt = ?,
            notes = ?,
            updated_at = NOW()
      WHERE id = ?`,
    [
      name.trim(),
      phone !== undefined ? (phone?.trim() || null) : customer.phone,
      email !== undefined ? (email?.trim() || null) : customer.email,
      address !== undefined ? (address?.trim() || null) : customer.address,
      cnic !== undefined ? (cnic?.trim() || null) : customer.cnic,
      isTaxExempt !== undefined ? (isTaxExempt ? 1 : 0) : customer.isTaxExempt,
      notes !== undefined ? (notes?.trim() || null) : customer.notes,
      id,
    ]
  );

  await logAudit({
    userId,
    action: 'UPDATE',
    tableName: 'customers',
    recordId: id,
    oldValues: { name: customer.name, phone: customer.phone, email: customer.email },
    newValues: { name: name.trim(), phone: phone?.trim(), email: email?.trim() },
  });

  return getCustomerById(id);
}

export async function deleteCustomer(id, userId) {
  const customer = await getCustomerById(id);

  await query('UPDATE customers SET deleted_at = NOW() WHERE id = ?', [id]);

  await logAudit({
    userId,
    action: 'DELETE',
    tableName: 'customers',
    recordId: id,
    oldValues: { name: customer.name, phone: customer.phone },
  });

  return { message: 'Customer soft-deleted successfully' };
}

export default {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
};
