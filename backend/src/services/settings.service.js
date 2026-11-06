import { query } from '../config/db.js';
import { logAudit } from './audit.service.js';
import { ApiError } from '../utils/ApiError.js';

export async function getAllSettings() {
  const rows = await query('SELECT setting_key, setting_value, setting_group, description, is_editable FROM pharmacy_settings');
  const settingsMap = {};
  for (const row of rows) {
    settingsMap[row.setting_key] = row.setting_value;
  }
  return {
    raw: rows,
    map: settingsMap,
    ...settingsMap,
  };
}

export async function updateSettings(updates, userId) {
  for (const [key, value] of Object.entries(updates)) {
    await query(
      `INSERT INTO pharmacy_settings (setting_key, setting_value)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [key, String(value)]
    );
  }

  await logAudit({
    userId,
    action: 'UPDATE',
    tableName: 'pharmacy_settings',
    recordId: 'CONFIG',
    newValues: updates,
  });

  return getAllSettings();
}

export async function getCurrencies() {
  return query('SELECT code, name, symbol, locale, exchange_rate, is_base, is_active FROM currencies ORDER BY is_base DESC, name ASC');
}

export async function getTaxRules() {
  return query('SELECT id, name, code, rate_percent, description, is_default, is_active FROM tax_rules ORDER BY rate_percent ASC');
}

export async function getSuppliers() {
  return query('SELECT id, name, contact_person, phone, email, address, city, payment_terms, status, notes, created_at FROM suppliers ORDER BY name ASC');
}

export async function createSupplier(data, userId) {
  const {
    name,
    contactPerson,
    contact_person,
    phone,
    email,
    address,
    city = 'Karachi',
    paymentTerms = 'Net 30',
    payment_terms,
    status = 'active',
    notes,
  } = data;

  if (!name || !name.trim()) {
    throw ApiError.badRequest('Supplier name is required');
  }
  if (!phone || !phone.trim()) {
    throw ApiError.badRequest('Supplier phone number is required');
  }

  const result = await query(
    `INSERT INTO suppliers (name, contact_person, phone, email, address, city, payment_terms, status, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      name.trim(),
      contact_person || contactPerson || null,
      phone.trim(),
      email ? email.trim() : null,
      address ? address.trim() : null,
      city ? city.trim() : 'Karachi',
      payment_terms || paymentTerms || 'Net 30',
      status || 'active',
      notes ? notes.trim() : null,
    ]
  );

  const insertedId = result.insertId;

  await logAudit({
    userId,
    action: 'CREATE_SUPPLIER',
    table: 'suppliers',
    recordId: insertedId,
    details: { name: name.trim() },
  });

  return {
    id: insertedId,
    name: name.trim(),
    contact_person: contact_person || contactPerson || null,
    phone: phone.trim(),
    email: email ? email.trim() : null,
    city: city ? city.trim() : 'Karachi',
    payment_terms: payment_terms || paymentTerms || 'Net 30',
    status: status || 'active',
  };
}

export async function updateSupplier(id, data, userId) {
  const existing = await query('SELECT * FROM suppliers WHERE id = ?', [id]);
  if (!existing || existing.length === 0) {
    throw ApiError.notFound(`Supplier with ID ${id} not found`);
  }

  const {
    name,
    contactPerson,
    contact_person,
    phone,
    email,
    address,
    city,
    paymentTerms,
    payment_terms,
    status,
    notes,
  } = data;

  const updatedName = name !== undefined ? name.trim() : existing[0].name;
  if (!updatedName) {
    throw ApiError.badRequest('Supplier name cannot be empty');
  }
  const updatedPhone = phone !== undefined ? phone.trim() : existing[0].phone;
  if (!updatedPhone) {
    throw ApiError.badRequest('Phone number cannot be empty');
  }

  await query(
    `UPDATE suppliers
     SET name = ?,
         contact_person = ?,
         phone = ?,
         email = ?,
         address = ?,
         city = ?,
         payment_terms = ?,
         status = ?,
         notes = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      updatedName,
      contact_person !== undefined ? contact_person : (contactPerson !== undefined ? contactPerson : existing[0].contact_person),
      updatedPhone,
      email !== undefined ? email : existing[0].email,
      address !== undefined ? address : existing[0].address,
      city !== undefined ? city : existing[0].city,
      payment_terms !== undefined ? payment_terms : (paymentTerms !== undefined ? paymentTerms : existing[0].payment_terms),
      status !== undefined ? status : existing[0].status,
      notes !== undefined ? notes : existing[0].notes,
      id,
    ]
  );

  await logAudit({
    userId,
    action: 'UPDATE_SUPPLIER',
    table: 'suppliers',
    recordId: id,
    details: { name: updatedName },
  });

  const updated = await query('SELECT id, name, contact_person, phone, email, address, city, payment_terms, status, notes, updated_at FROM suppliers WHERE id = ?', [id]);
  return updated[0];
}

export async function deleteSupplier(id, userId) {
  const existing = await query('SELECT * FROM suppliers WHERE id = ?', [id]);
  if (!existing || existing.length === 0) {
    throw ApiError.notFound(`Supplier with ID ${id} not found`);
  }

  // Check if supplier is referenced in purchase orders
  const poCheck = await query('SELECT id FROM purchase_orders WHERE supplier_id = ? LIMIT 1', [id]);
  if (poCheck.length > 0) {
    // Soft delete if referenced
    await query("UPDATE suppliers SET status = 'inactive', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [id]);
    await logAudit({
      userId,
      action: 'DEACTIVATE_SUPPLIER',
      table: 'suppliers',
      recordId: id,
      details: { reason: 'Has linked purchase orders; deactivated instead of deleted' },
    });
    return { id, deactivated: true, message: 'Supplier deactivated because purchase orders exist for this supplier.' };
  }

  // If no purchase orders, delete row
  await query('DELETE FROM suppliers WHERE id = ?', [id]);
  await logAudit({
    userId,
    action: 'DELETE_SUPPLIER',
    table: 'suppliers',
    recordId: id,
    details: { name: existing[0].name },
  });

  return { id, deleted: true, message: 'Supplier deleted successfully.' };
}

export async function getCustomers({ search, limit = 20 }) {
  const whereSql = search ? 'WHERE name LIKE ? OR phone LIKE ?' : '';
  const params = search ? [`%${search}%`, `%${search}%`] : [];
  return query(`SELECT id, name, phone, email, cnic_or_id FROM customers ${whereSql} LIMIT ?`, [...params, limit]);
}

export default {
  getAllSettings,
  updateSettings,
  getCurrencies,
  getTaxRules,
  getSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  getCustomers,
};
