#!/usr/bin/env node
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { Writable } from 'stream';

dotenv.config();

// =============================================================================
// 1. Strict Remote Target Verification
// =============================================================================
const host = process.env.DB_HOST || '';
const port = parseInt(process.env.DB_PORT || '4000', 10);
const user = process.env.DB_USER || '';
const password = process.env.DB_PASSWORD || '';
const database = process.env.DB_NAME || '';
const caPath = process.env.DB_CA_PATH || 'certs/isrgrootx1.pem';

// Strict safeguards against targeting local database
if (!host.includes('tidbcloud.com')) {
  console.error('\n[SAFETY ABORT] Target host is not TiDB Cloud!');
  console.error(`Detected Host: ${host || 'EMPTY'}`);
  console.error('This script is strictly restricted to remote TiDB Cloud.');
  process.exit(1);
}

if (database !== 'pharmacare') {
  console.error('\n[SAFETY ABORT] Target database is not "pharmacare"!');
  console.error(`Detected Database: ${database || 'EMPTY'}`);
  process.exit(1);
}

const isDryRun = process.argv.includes('--dry-run') || process.argv.includes('--preflight');

// =============================================================================
// 2. Canonical RBAC Reference Data (22 System Permissions)
// =============================================================================
const SYSTEM_ROLES = [
  { name: 'admin', display_name: 'System Administrator', description: 'Full administrative control over users, settings, and audits', is_system_role: true },
  { name: 'pharmacist', display_name: 'Licensed Pharmacist', description: 'Authorized to dispense, verify prescriptions, and manage clinical inventory', is_system_role: true },
  { name: 'stock_manager', display_name: 'Inventory Manager', description: 'Manages suppliers, purchase orders, deliveries, and stock transfers', is_system_role: true },
  { name: 'cashier', display_name: 'POS Cashier', description: 'Point of Sale billing, payment receipts, and customer checkout', is_system_role: true },
];

const SYSTEM_PERMISSIONS = [
  // 20 Core Schema Permissions
  { code: 'dashboard:view', module: 'dashboard', description: 'View dashboard metrics and analytics' },
  { code: 'medicines:view', module: 'medicines', description: 'View medicine catalogue' },
  { code: 'medicines:create', module: 'medicines', description: 'Create new medicine entries' },
  { code: 'medicines:edit', module: 'medicines', description: 'Edit existing medicines and packaging' },
  { code: 'medicines:delete', module: 'medicines', description: 'Discontinue or soft-delete medicines' },
  { code: 'inventory:view', module: 'inventory', description: 'View stock batches and movements' },
  { code: 'inventory:adjust', module: 'inventory', description: 'Perform stock adjustments and write-offs' },
  { code: 'inventory:quarantine', module: 'inventory', description: 'Quarantine or recall stock batches' },
  { code: 'pos:access', module: 'pos', description: 'Access Point of Sale billing terminal' },
  { code: 'pos:dispense', module: 'pos', description: 'Dispense medicines and finalize sales' },
  { code: 'pos:apply_discount', module: 'pos', description: 'Apply manual discounts to sale invoices' },
  { code: 'returns:process', module: 'returns', description: 'Process customer and supplier returns' },
  { code: 'prescriptions:view', module: 'prescriptions', description: 'View restricted prescription records' },
  { code: 'prescriptions:verify', module: 'prescriptions', description: 'Verify and approve medical prescriptions' },
  { code: 'purchases:view', module: 'purchases', description: 'View purchase orders and supplier invoices' },
  { code: 'purchases:create', module: 'purchases', description: 'Create and receive purchase orders' },
  { code: 'suppliers:manage', module: 'suppliers', description: 'Manage supplier directory and terms' },
  { code: 'reports:view', module: 'reports', description: 'View sales, financial, and stock valuation reports' },
  { code: 'users:manage', module: 'users', description: 'Create and manage staff accounts and roles' },
  { code: 'settings:edit', module: 'settings', description: 'Update pharmacy configuration and tax rules' },
  // 2 Migration 001 Permissions
  { code: 'inquiries:view', module: 'inquiries', description: 'View public doctor medicine availability inquiries' },
  { code: 'inquiries:respond', module: 'inquiries', description: 'Inspect prescription images, match stock and email responses' },
];

// =============================================================================
// 3. Interactive Prompt Session (Single Shared Readline Interface)
// =============================================================================
function createPromptSession() {
  const isTTY = Boolean(process.stdin.isTTY);
  let muted = false;

  const mutableStdout = new Writable({
    write(chunk, encoding, callback) {
      if (!muted || !isTTY) {
        process.stdout.write(chunk, encoding);
      }
      callback();
    },
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: mutableStdout,
    terminal: isTTY,
  });

  function prompt(questionText) {
    return new Promise((resolve) => {
      muted = false;
      rl.question(questionText, (answer) => {
        resolve(answer.trim());
      });
    });
  }

  function promptHidden(questionText) {
    return new Promise((resolve) => {
      muted = false;
      rl.question(questionText, (answer) => {
        muted = false;
        if (isTTY) {
          process.stdout.write('\n');
        }
        // Normalize any trailing carriage return without altering password characters
        resolve(answer.replace(/\r$/, ''));
      });
      // Mute terminal echoing for password characters
      if (isTTY) {
        muted = true;
      }
    });
  }

  function close() {
    muted = false;
    rl.close();
  }

  return { prompt, promptHidden, close };
}

// Password Complexity Validator
function validatePasswordStrength(pwd) {
  if (!pwd || pwd.length < 10) {
    return 'Password must be at least 10 characters long';
  }
  if (!/[A-Z]/.test(pwd)) {
    return 'Password must contain at least one uppercase letter (A-Z)';
  }
  if (!/[a-z]/.test(pwd)) {
    return 'Password must contain at least one lowercase letter (a-z)';
  }
  if (!/[0-9]/.test(pwd)) {
    return 'Password must contain at least one numeric digit (0-9)';
  }
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pwd)) {
    return 'Password must contain at least one special character (!@#$%^&*...)';
  }
  return null;
}

// =============================================================================
// 4. Main Setup Routine
// =============================================================================
async function main() {
  console.log('='.repeat(75));
  console.log(`  PharmaCare — Production Admin Account Setup ${isDryRun ? '[PREFLIGHT / DRY-RUN]' : ''}`);
  console.log('='.repeat(75));
  console.log(`  Target Host:     ${host}`);
  console.log(`  Target Database: ${database}`);
  console.log(`  Target Port:     ${port}`);
  console.log(`  Mode:            ${isDryRun ? 'DRY-RUN (Validation only, NO database writes)' : 'LIVE SETUP'}`);

  const resolvedCaPath = path.isAbsolute(caPath) ? caPath : path.resolve(process.cwd(), caPath);
  if (!fs.existsSync(resolvedCaPath)) {
    throw new Error(`CA certificate not found at ${resolvedCaPath}`);
  }

  const caBuffer = fs.readFileSync(resolvedCaPath);
  const connConfig = {
    host,
    port,
    user,
    password,
    database,
    connectTimeout: 30000, // Extended 30s timeout for WAN latency & TLS handshake to TiDB Cloud
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    ssl: {
      ca: caBuffer,
      minVersion: 'TLSv1.2',
      rejectUnauthorized: true,
    },
  };

  // Safe connection helper with retry mechanism for transient network jitter / handshake delays
  let conn;
  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 1) {
        console.log(`\n[CONNECTION RETRY] Attempt ${attempt}/${maxRetries} connecting to TiDB Cloud...`);
      }
      conn = await mysql.createConnection(connConfig);
      break;
    } catch (err) {
      if (attempt < maxRetries && (err.code === 'ETIMEDOUT' || err.code === 'ECONNRESET' || err.code === 'PROTOCOL_CONNECTION_LOST' || err.message?.includes('timeout'))) {
        console.warn(`\n[CONNECTION NOTICE] Attempt ${attempt} failed with ${err.code || err.message}. Retrying in 2 seconds...`);
        await new Promise((res) => setTimeout(res, 2000));
      } else {
        throw err;
      }
    }
  }

  try {
    // 1. Verify Active Database
    const [[dbCheck]] = await conn.query('SELECT DATABASE() AS currentDb;');
    if (dbCheck.currentDb !== 'pharmacare') {
      throw new Error(`Connected database "${dbCheck.currentDb}" does not match target "pharmacare"`);
    }
    console.log(`\n[1/5] Database Connection Verified: Connected to "${dbCheck.currentDb}" on TiDB Cloud.`);

    // 2. Overwrite Protection: Check for existing active Admin accounts
    const [existingAdmins] = await conn.query(
      `SELECT u.id, u.username, u.email
         FROM users u
         JOIN roles r ON u.role_id = r.id
        WHERE r.name = 'admin' AND u.deleted_at IS NULL AND u.status = 'active'`
    );

    if (existingAdmins.length > 0) {
      console.log(`\n[WARNING] Active Admin user already exists on remote database:`);
      for (const adm of existingAdmins) {
        console.log(`  - ID: ${adm.id} | Username: ${adm.username} | Email: ${adm.email}`);
      }
      console.log('\n[ABORTED] To prevent accidental overwrites, an Admin user already exists.');
      console.log('If you need to reset passwords, use the authenticated user management interface.');
      process.exit(0);
    }
    console.log('[2/5] Overwrite Guard: No active Admin user exists. Ready for initialization.');

    // 3. Inspect Current Roles & Permissions
    const [currentRoles] = await conn.query('SELECT id, name FROM roles');
    const [currentPerms] = await conn.query('SELECT id, code FROM permissions');
    console.log(`\n[3/5] Schema State:`);
    console.log(`  - Existing roles:       ${currentRoles.length} / 4 expected`);
    console.log(`  - Existing permissions: ${currentPerms.length} / 22 canonical`);

    if (isDryRun) {
      console.log('\n' + '-'.repeat(75));
      console.log('  PREFLIGHT VALIDATION SUMMARY (No writes performed)');
      console.log('-'.repeat(75));
      console.log('  1. TiDB Cloud TLS handshake:                [PASSED]');
      console.log('  2. Remote database "pharmacare" verified:   [PASSED]');
      console.log('  3. No existing Admin account found:         [PASSED]');
      console.log(`  4. System roles to register:                4 (${SYSTEM_ROLES.map(r => r.name).join(', ')})`);
      console.log(`  5. Canonical permissions to verify/create:  22 permissions`);
      console.log(`  6. Role assignment strategy:                Dynamic role ID lookup (no hardcoded IDs)`);
      console.log(`  7. Password encryption strategy:            bcryptjs (${process.env.BCRYPT_SALT_ROUNDS || 12} rounds)`);
      console.log(`  8. Transactional rollback guarantee:        Active with COMMIT/ROLLBACK`);
      console.log('-'.repeat(75));
      console.log('\nPreflight successful. Ready for interactive admin setup execution.\n');
      process.exit(0);
    }

    // 4. Interactive Admin Credential Prompts (Live Mode Only)
    console.log('\n[4/5] Enter Initial Administrator Account Details:');
    const session = createPromptSession();
    let fullName, username, email, pwd1, pwd2;

    try {
      fullName = process.env.ADMIN_NAME || (await session.prompt('  Admin Full Name (e.g. Chief Pharmacist): '));
      if (!fullName) throw new Error('Admin full name is required');

      username = process.env.ADMIN_USERNAME || (await session.prompt('  Admin Username (e.g. admin or dr.ali): '));
      if (!username || username.length < 3) throw new Error('Username must be at least 3 characters long');

      email = process.env.ADMIN_EMAIL || (await session.prompt('  Admin Email (e.g. admin@pharmacare.pk): '));
      if (!email || !/@.+\..+/.test(email)) throw new Error('A valid email address is required');

      // Check duplicate username/email
      const [dupCheck] = await conn.query(
        'SELECT username, email FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)',
        [username, email]
      );
      if (dupCheck.length > 0) {
        throw new Error(`Username "${username}" or email "${email}" is already registered`);
      }

      // Secure password entry with masking (or private environment variable if non-interactive)
      console.log('\n  [SECURITY NOTICE] For privacy, characters will NOT appear on screen while you type.');
      console.log('                    Type your password normally and press Enter when finished.\n');

      if (process.env.ADMIN_PASSWORD) {
        pwd1 = process.env.ADMIN_PASSWORD;
        pwd2 = process.env.ADMIN_PASSWORD;
      } else {
        pwd1 = await session.promptHidden('  Enter Admin Password: ');
        const pwdErr = validatePasswordStrength(pwd1);
        if (pwdErr) {
          console.error('\n[VALIDATION ERROR] Password does not meet complexity requirements:');
          console.error(`  -> ${pwdErr}`);
          console.error('\n  Password Policy:');
          console.error('    - Minimum 10 characters in length');
          console.error('    - At least one uppercase letter (A-Z)');
          console.error('    - At least one lowercase letter (a-z)');
          console.error('    - At least one numeric digit (0-9)');
          console.error('    - At least one special symbol (!@#$%^&*()_+-=[]{};\':"\\|,.<>/?)');
          throw new Error(`Password complexity error: ${pwdErr}`);
        }

        pwd2 = await session.promptHidden('  Confirm Admin Password: ');
        if (pwd1 !== pwd2) {
          console.error('\n[VALIDATION ERROR] Passwords do not match:');
          console.error(`  - First password length:        ${pwd1.length} characters`);
          console.error(`  - Confirmation password length: ${pwd2.length} characters`);
          console.error('  Please verify and re-type carefully.');
          throw new Error('Passwords do not match');
        }
      }
    } finally {
      session.close();
    }

    // 5. Transactional Execution
    console.log('\n[5/5] Executing Transactional Account Creation...');
    await conn.beginTransaction();

    try {
      // 5A. Register System Roles
      for (const roleDef of SYSTEM_ROLES) {
        await conn.execute(
          `INSERT INTO roles (name, display_name, description, is_system_role)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE display_name = VALUES(display_name), description = VALUES(description)`,
          [roleDef.name, roleDef.display_name, roleDef.description, roleDef.is_system_role]
        );
      }

      // 5B. Dynamically Query Admin Role ID (Never hardcode role_id: 1)
      const [adminRoleRows] = await conn.execute(
        'SELECT id FROM roles WHERE name = "admin" LIMIT 1'
      );
      if (!adminRoleRows || adminRoleRows.length === 0) {
        throw new Error('Failed to resolve dynamic ID for role "admin"');
      }
      const adminRoleId = adminRoleRows[0].id;

      // 5C. Register Canonical System Permissions (22 total)
      for (const permDef of SYSTEM_PERMISSIONS) {
        await conn.execute(
          `INSERT INTO permissions (code, module, description)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE description = VALUES(description)`,
          [permDef.code, permDef.module, permDef.description]
        );
      }

      // 5D. Map All Permissions to Admin Role Dynamically
      await conn.execute(
        `INSERT IGNORE INTO role_permissions (role_id, permission_id)
         SELECT ?, id FROM permissions`,
        [adminRoleId]
      );

      // 5E. Hash Password In-Memory with bcrypt (12 rounds)
      const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10);
      const passwordHash = await bcrypt.hash(pwd1, saltRounds);

      // 5F. Insert Single Admin User
      const [userResult] = await conn.execute(
        `INSERT INTO users (role_id, username, email, password_hash, full_name, phone, status)
         VALUES (?, ?, ?, ?, ?, NULL, 'active')`,
        [adminRoleId, username.toLowerCase().trim(), email.toLowerCase().trim(), passwordHash, fullName.trim()]
      );

      const adminUserId = userResult.insertId;

      // 5G. Log Immutable Audit Record
      await conn.execute(
        `INSERT INTO audit_logs (user_id, action, table_name, record_id, old_values, new_values)
         VALUES (?, 'CREATE', 'users', ?, NULL, ?)`,
        [
          adminUserId,
          String(adminUserId),
          JSON.stringify({ username: username.toLowerCase().trim(), email: email.toLowerCase().trim(), role: 'admin' }),
        ]
      );

      // Commit the transaction
      await conn.commit();

      console.log('\n' + '='.repeat(75));
      console.log('  ADMIN ACCOUNT INITIALIZATION COMPLETED SUCCESSFULLY');
      console.log('='.repeat(75));
      console.log(`  Admin User ID:  ${adminUserId}`);
      console.log(`  Admin Name:     ${fullName.trim()}`);
      console.log(`  Admin Username: ${username.toLowerCase().trim()}`);
      console.log(`  Admin Email:    ${email.toLowerCase().trim()}`);
      console.log(`  Assigned Role:  admin (Role ID: ${adminRoleId})`);
      console.log(`  Permissions:    All 22 system permissions granted`);
      console.log('='.repeat(75));
      console.log('\nYou can now log in to the PharmaCare dashboard using these credentials.');
      console.log('Keep your password confidential.\n');
    } catch (txErr) {
      await conn.rollback();
      throw txErr;
    }
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('\n[FATAL ERROR]:', err.message);
  process.exit(1);
});
