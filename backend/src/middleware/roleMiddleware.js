import { ApiError } from '../utils/ApiError.js';
import { query } from '../config/db.js';

/**
 * Role-Based Access Control (RBAC) middleware.
 * Verifies that the authenticated user possesses one of the allowed role names.
 * @param  {...string} allowedRoles - e.g. 'admin', 'pharmacist'
 */
export function hasRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized());
    }

    const userRole = req.user.role;
    if (!userRole || !allowedRoles.includes(userRole)) {
      return next(
        ApiError.forbidden(
          `Access restricted: requires one of the following roles: [${allowedRoles.join(', ')}]`
        )
      );
    }

    next();
  };
}

/**
 * Granular Permission-Based middleware.
 * Verifies that the user's role has been granted the required permission code.
 * @param {string} permissionCode - e.g. 'pos:dispense', 'prescriptions:verify'
 */
export function hasPermission(permissionCode) {
  return async (req, res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized());
    }

    // Admins always bypass granular permission checks
    if (req.user.role === 'admin') {
      return next();
    }

    try {
      const rows = await query(
        `SELECT 1
           FROM role_permissions rp
           JOIN permissions p ON rp.permission_id = p.id
          WHERE rp.role_id = ? AND p.code = ?
          LIMIT 1`,
        [req.user.roleId, permissionCode]
      );

      if (!rows || rows.length === 0) {
        return next(
          ApiError.forbidden(`Access denied: missing required permission '${permissionCode}'`)
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
