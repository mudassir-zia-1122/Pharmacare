import bcrypt from 'bcryptjs';
import { query } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { logAudit } from './audit.service.js';

export async function listUsers() {
  const rows = await query(
    `SELECT u.id, u.username, u.email, u.full_name AS fullName, u.phone,
            u.status, u.role_id AS roleId, r.name AS role, r.display_name AS roleDisplay,
            u.last_login_at AS lastLoginAt, u.created_at AS createdAt
       FROM users u
       JOIN roles r ON u.role_id = r.id
      WHERE u.deleted_at IS NULL
      ORDER BY u.id ASC`
  );
  return rows;
}

export async function getUserById(id) {
  const rows = await query(
    `SELECT u.id, u.username, u.email, u.full_name AS fullName, u.phone,
            u.status, u.role_id AS roleId, r.name AS role, r.display_name AS roleDisplay,
            u.last_login_at AS lastLoginAt, u.created_at AS createdAt
       FROM users u
       JOIN roles r ON u.role_id = r.id
      WHERE u.id = ? AND u.deleted_at IS NULL
      LIMIT 1`,
    [id]
  );
  if (!rows || rows.length === 0) {
    throw ApiError.notFound(`User with ID ${id} not found`);
  }
  return rows[0];
}

export async function createUser(data, adminUserId) {
  const { name, username, email, role, password, phone, status = 'active' } = data;

  if (!name || !username || !email || !role || !password) {
    throw ApiError.badRequest('Name, username, email, role, and password are required');
  }

  if (password.length < 8) {
    throw ApiError.badRequest('Password must be at least 8 characters long');
  }

  // Check username uniqueness
  const existingUsername = await query(
    'SELECT id FROM users WHERE LOWER(username) = LOWER(?) AND deleted_at IS NULL LIMIT 1',
    [username.trim()]
  );
  if (existingUsername.length > 0) {
    throw ApiError.conflict(`Username '${username}' is already taken`);
  }

  // Check email uniqueness
  const existingEmail = await query(
    'SELECT id FROM users WHERE LOWER(email) = LOWER(?) AND deleted_at IS NULL LIMIT 1',
    [email.trim()]
  );
  if (existingEmail.length > 0) {
    throw ApiError.conflict(`Email '${email}' is already registered`);
  }

  // Resolve role ID
  const roles = await query('SELECT id FROM roles WHERE name = ? LIMIT 1', [role]);
  if (!roles || roles.length === 0) {
    throw ApiError.badRequest(`Invalid role '${role}'`);
  }
  const roleId = roles[0].id;

  // Hash password
  const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10);
  const passwordHash = await bcrypt.hash(password, saltRounds);

  const result = await query(
    `INSERT INTO users (role_id, username, email, password_hash, full_name, phone, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [roleId, username.trim().toLowerCase(), email.trim().toLowerCase(), passwordHash, name.trim(), phone || null, status]
  );

  const newUserId = result.insertId;

  await logAudit({
    userId: adminUserId,
    action: 'CREATE_USER',
    tableName: 'users',
    recordId: newUserId,
    oldValues: null,
    newValues: { username, email, role, status },
  });

  return getUserById(newUserId);
}

export async function updateUser(id, data, adminUserId) {
  const currentUser = await getUserById(id);
  const { name, role, status, password, phone } = data;

  let roleId = currentUser.roleId;
  if (role && role !== currentUser.role) {
    const roles = await query('SELECT id FROM roles WHERE name = ? LIMIT 1', [role]);
    if (!roles || roles.length === 0) {
      throw ApiError.badRequest(`Invalid role '${role}'`);
    }
    roleId = roles[0].id;
  }

  // Safety: Prevent deactivating the logged-in administrator
  if (Number(id) === Number(adminUserId) && status === 'inactive') {
    throw ApiError.badRequest('You cannot deactivate your own active admin account');
  }

  const updates = [];
  const params = [];

  if (name) {
    updates.push('full_name = ?');
    params.push(name.trim());
  }

  if (roleId) {
    updates.push('role_id = ?');
    params.push(roleId);
  }

  if (status) {
    updates.push('status = ?');
    params.push(status);
  }

  if (phone !== undefined) {
    updates.push('phone = ?');
    params.push(phone);
  }

  if (password && password.trim()) {
    if (password.trim().length < 8) {
      throw ApiError.badRequest('New password must be at least 8 characters long');
    }
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10);
    const passwordHash = await bcrypt.hash(password.trim(), saltRounds);
    updates.push('password_hash = ?');
    params.push(passwordHash);
  }

  if (updates.length > 0) {
    params.push(id);
    await query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);

    await logAudit({
      userId: adminUserId,
      action: 'UPDATE_USER',
      tableName: 'users',
      recordId: id,
      oldValues: { role: currentUser.role, status: currentUser.status },
      newValues: { role, status, updatedFields: updates },
    });
  }

  return getUserById(id);
}

export async function toggleUserStatus(id, adminUserId) {
  if (Number(id) === Number(adminUserId)) {
    throw ApiError.badRequest('You cannot deactivate your own active admin account');
  }

  const user = await getUserById(id);
  const newStatus = user.status === 'active' ? 'inactive' : 'active';

  await query('UPDATE users SET status = ? WHERE id = ?', [newStatus, id]);

  await logAudit({
    userId: adminUserId,
    action: 'TOGGLE_USER_STATUS',
    tableName: 'users',
    recordId: id,
    oldValues: { status: user.status },
    newValues: { status: newStatus },
  });

  return { id, status: newStatus };
}

export default {
  listUsers,
  getUserById,
  createUser,
  updateUser,
  toggleUserStatus,
};
