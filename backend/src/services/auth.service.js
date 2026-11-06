import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { logAudit } from './audit.service.js';

export async function loginUser(identifier, password, ipAddress, userAgent) {
  if (!identifier || !password) {
    throw ApiError.badRequest('Username/email and password are required');
  }

  const trimmedIdentifier = identifier.toString().trim().toLowerCase();

  const users = await query(
    `SELECT u.id, u.username, u.email, u.password_hash, u.full_name, u.phone,
            u.status, u.role_id, r.name AS role_name, r.display_name AS role_display
       FROM users u
       JOIN roles r ON u.role_id = r.id
      WHERE (LOWER(u.username) = ? OR LOWER(u.email) = ?) AND u.deleted_at IS NULL
      LIMIT 1`,
    [trimmedIdentifier, trimmedIdentifier]
  );

  if (!users || users.length === 0) {
    throw ApiError.unauthorized('Invalid username or password');
  }

  const user = users[0];

  if (user.status !== 'active') {
    throw ApiError.forbidden('User account is currently disabled. Please contact administrator.');
  }

  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    throw ApiError.unauthorized('Invalid username or password');
  }

  // Generate short-lived JWT token
  const secret = process.env.JWT_SECRET || 'fallback_secret_never_use_in_prod';
  const expiresIn = process.env.JWT_EXPIRES_IN || '8h';

  const token = jwt.sign(
    {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role_name,
      roleId: user.role_id,
    },
    secret,
    { expiresIn }
  );

  // Update last_login_at
  await query('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

  // Log successful login audit
  await logAudit({
    userId: user.id,
    action: 'LOGIN',
    tableName: 'users',
    recordId: user.id,
    ipAddress,
    userAgent,
  });

  return {
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.full_name,
      role: user.role_name,
      roleDisplay: user.role_display,
    },
  };
}

export async function getUserProfile(userId) {
  const users = await query(
    `SELECT u.id, u.username, u.email, u.full_name, u.phone, u.status, u.last_login_at,
            r.name AS role, r.display_name AS role_display
       FROM users u
       JOIN roles r ON u.role_id = r.id
      WHERE u.id = ? AND u.deleted_at IS NULL
      LIMIT 1`,
    [userId]
  );

  if (!users || users.length === 0) {
    throw ApiError.notFound('User profile not found');
  }

  return users[0];
}

export async function changeUserPassword(userId, oldPassword, newPassword, ipAddress) {
  const users = await query('SELECT password_hash FROM users WHERE id = ?', [userId]);
  if (!users || users.length === 0) {
    throw ApiError.notFound('User not found');
  }

  const isMatch = await bcrypt.compare(oldPassword, users[0].password_hash);
  if (!isMatch) {
    throw ApiError.badRequest('Current password provided is incorrect');
  }

  const rounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10);
  const newHash = await bcrypt.hash(newPassword, rounds);

  await query('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, userId]);

  await logAudit({
    userId,
    action: 'UPDATE',
    tableName: 'users',
    recordId: userId,
    newValues: { changed: 'password' },
    ipAddress,
  });

  return { message: 'Password changed successfully' };
}

export async function loginWithFirebase(idToken, email, ipAddress, userAgent) {
  if (!email) {
    throw ApiError.badRequest('Email is required for Firebase authentication');
  }

  // Look up user by email in database
  const users = await query(
    `SELECT u.id, u.username, u.email, u.full_name, u.phone,
            u.status, u.role_id, r.name AS role_name, r.display_name AS role_display
       FROM users u
       JOIN roles r ON u.role_id = r.id
      WHERE u.email = ? AND u.deleted_at IS NULL
      LIMIT 1`,
    [email.toLowerCase().trim()]
  );

  if (!users || users.length === 0) {
    throw ApiError.forbidden(
      `Firebase account (${email}) is not registered in the PharmaCare staff directory. Please contact your administrator.`
    );
  }

  const user = users[0];

  if (user.status !== 'active') {
    throw ApiError.forbidden('User account is currently disabled. Please contact administrator.');
  }

  // Generate short-lived JWT token matching the backend standard
  const secret = process.env.JWT_SECRET || 'fallback_secret_never_use_in_prod';
  const expiresIn = process.env.JWT_EXPIRES_IN || '8h';

  const token = jwt.sign(
    {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role_name,
      roleId: user.role_id,
      authProvider: 'firebase',
    },
    secret,
    { expiresIn }
  );

  // Update last_login_at
  await query('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

  // Log successful login audit
  await logAudit({
    userId: user.id,
    action: 'LOGIN_FIREBASE',
    tableName: 'users',
    recordId: user.id,
    ipAddress,
    userAgent,
    details: { authProvider: 'firebase', email },
  });

  return {
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.full_name,
      role: user.role_name,
      roleDisplay: user.role_display,
    },
  };
}

export default {
  loginUser,
  getUserProfile,
  changeUserPassword,
  loginWithFirebase,
};
