import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';
import { getJwtSecret } from '../config/security.js';
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
  const secret = getJwtSecret();
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

/**
 * Lazily verifies a Firebase ID token using Firebase Admin SDK.
 * Fails closed unless FIREBASE_AUTH_ENABLED=true AND firebase-admin is installed
 * and initialized with server-side service account credentials.
 */
async function verifyFirebaseIdTokenServerSide(idToken) {
  if (process.env.FIREBASE_AUTH_ENABLED !== 'true') {
    throw new ApiError(
      503,
      'Firebase authentication is disabled on this server. Please sign in with your staff account.'
    );
  }

  let admin;
  try {
    const mod = await import('firebase-admin');
    admin = mod.default || mod;
  } catch {
    throw new ApiError(
      503,
      'Firebase Admin SDK is not installed on the server. Firebase authentication is disabled.'
    );
  }

  if (!admin.apps || admin.apps.length === 0) {
    const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (rawServiceAccount) {
      let serviceAccount;
      try {
        serviceAccount = JSON.parse(rawServiceAccount);
      } catch {
        throw new ApiError(503, 'Invalid Firebase Admin service account configuration.');
      }
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
      });
    } else {
      throw new ApiError(
        503,
        'Firebase Admin credentials are not configured on the server. Firebase authentication is disabled.'
      );
    }
  }

  try {
    return await admin.auth().verifyIdToken(idToken, true);
  } catch {
    throw ApiError.unauthorized('Invalid or expired Firebase authentication token.');
  }
}

export async function loginWithFirebase(idToken, _clientEmail, ipAddress, userAgent) {
  // Strictly require a structurally valid token before anything else
  if (
    !idToken ||
    typeof idToken !== 'string' ||
    idToken.trim().split('.').length !== 3
  ) {
    throw ApiError.unauthorized('A valid Firebase ID token is required.');
  }

  // Cryptographically verify token server-side; NEVER trust client-supplied email or role
  const decodedFirebaseToken = await verifyFirebaseIdTokenServerSide(idToken.trim());

  const verifiedEmail = decodedFirebaseToken?.email?.toLowerCase().trim();
  if (!verifiedEmail) {
    throw ApiError.unauthorized('Verified Firebase token does not contain an email identity.');
  }

  if (decodedFirebaseToken.email_verified === false) {
    throw ApiError.forbidden('Firebase email address must be verified before signing in.');
  }

  // Fetch actual user role and account status from the database
  const users = await query(
    `SELECT u.id, u.username, u.email, u.full_name, u.phone,
            u.status, u.role_id, r.name AS role_name, r.display_name AS role_display
       FROM users u
       JOIN roles r ON u.role_id = r.id
      WHERE LOWER(u.email) = ? AND u.deleted_at IS NULL
      LIMIT 1`,
    [verifiedEmail]
  );

  if (!users || users.length === 0) {
    throw ApiError.forbidden(
      'This verified account is not registered in the PharmaCare staff directory. Please contact your administrator.'
    );
  }

  const user = users[0];

  if (user.status !== 'active') {
    throw ApiError.forbidden('User account is currently disabled. Please contact administrator.');
  }

  // Generate short-lived JWT token using strictly validated server secret
  const secret = getJwtSecret();
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
    details: { authProvider: 'firebase', uid: decodedFirebaseToken.uid },
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
