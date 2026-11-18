import jwt from 'jsonwebtoken';
import { ApiError } from '../utils/ApiError.js';
import { query } from '../config/db.js';
import { getJwtSecret } from '../config/security.js';

/**
 * Authentication middleware.
 * Verifies Bearer JWT token in Authorization header, checks database user status,
 * and attaches user object to req.user.
 */
export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    let token = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.query && req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      throw ApiError.unauthorized('Authorization header or token query parameter required');
    }

    const secret = getJwtSecret();
    let decoded;
    try {
      decoded = jwt.verify(token, secret);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw ApiError.unauthorized('Session has expired. Please log in again.');
      }
      throw ApiError.unauthorized('Invalid authentication token');
    }

    // Verify user exists and is active in database (or fallback if DB offline)
    try {
      const users = await query(
        `SELECT u.id, u.username, u.email, u.full_name, u.status, u.role_id, r.name AS role_name
           FROM users u
           JOIN roles r ON u.role_id = r.id
          WHERE u.id = ? AND u.deleted_at IS NULL
          LIMIT 1`,
        [decoded.id]
      );

      if (!users || users.length === 0) {
        throw ApiError.unauthorized('User account no longer exists');
      }

      const user = users[0];
      if (user.status !== 'active') {
        throw ApiError.forbidden('User account is currently disabled. Contact administrator.');
      }

      req.user = {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.full_name,
        roleId: user.role_id,
        role: user.role_name,
      };
    } catch (dbError) {
      // If DB error is specifically our ApiError, rethrow
      if (dbError instanceof ApiError) throw dbError;

      // If DB connection fails entirely, fall back to token payload for degraded mode inspection
      req.user = {
        id: decoded.id,
        username: decoded.username,
        role: decoded.role || 'cashier',
      };
    }

    next();
  } catch (error) {
    next(error);
  }
}
