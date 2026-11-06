#!/usr/bin/env node
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { Writable } from 'stream';

dotenv.config();

const host = process.env.DB_HOST || '';
const port = parseInt(process.env.DB_PORT || '4000', 10);
const user = process.env.DB_USER || '';
const password = process.env.DB_PASSWORD || '';
const database = process.env.DB_NAME || '';
const caPath = process.env.DB_CA_PATH || 'certs/isrgrootx1.pem';
const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10);

if (!host.includes('tidbcloud.com') && !process.env.ALLOW_LOCAL_RESET) {
  console.error('\n[SAFETY ABORT] Target host is not TiDB Cloud!');
  process.exit(1);
}

if (database !== 'pharmacare') {
  console.error(`\n[SAFETY ABORT] Target database is not "pharmacare" (detected: "${database}")!`);
  process.exit(1);
}

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
        resolve(answer.replace(/\r$/, ''));
      });
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

function validatePasswordStrength(pwd) {
  if (!pwd || pwd.length < 10) return 'Password must be at least 10 characters long';
  if (!/[A-Z]/.test(pwd)) return 'Password must contain at least one uppercase letter (A-Z)';
  if (!/[a-z]/.test(pwd)) return 'Password must contain at least one lowercase letter (a-z)';
  if (!/[0-9]/.test(pwd)) return 'Password must contain at least one numeric digit (0-9)';
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pwd)) {
    return 'Password must contain at least one special character (!@#$%^&*...)';
  }
  return null;
}

async function main() {
  console.log('='.repeat(75));
  console.log('  PharmaCare — Safe Admin Credential Reset Utility');
  console.log('='.repeat(75));
  console.log(`  Target Host:     ${host}`);
  console.log(`  Target Database: ${database}`);

  const resolvedCaPath = path.isAbsolute(caPath) ? caPath : path.resolve(process.cwd(), caPath);
  const connConfig = {
    host,
    port,
    user,
    password,
    database,
    connectTimeout: 30000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    ssl: {
      ca: fs.readFileSync(resolvedCaPath),
      minVersion: 'TLSv1.2',
      rejectUnauthorized: true,
    },
  };

  const conn = await mysql.createConnection(connConfig);

  try {
    // 1. Locate the active Admin account
    const [adminUsers] = await conn.query(
      `SELECT u.id, u.username, u.email, u.full_name, u.status, r.name AS role_name
         FROM users u
         JOIN roles r ON u.role_id = r.id
        WHERE r.name = 'admin' AND u.deleted_at IS NULL`
    );

    if (adminUsers.length === 0) {
      console.error('\n[ERROR] No active Admin user found in database. Run "npm run setup:admin" instead.');
      process.exit(1);
    }

    const currentAdmin = adminUsers[0];
    console.log('\n[Current Administrator Account]:');
    console.log(`  - User ID:   ${currentAdmin.id}`);
    console.log(`  - Full Name: ${currentAdmin.full_name}`);
    console.log(`  - Username:  ${currentAdmin.username}`);
    console.log(`  - Email:     ${currentAdmin.email}`);
    console.log(`  - Role:      ${currentAdmin.role_name}`);
    console.log(`  - Status:    ${currentAdmin.status}`);

    const isNonInteractive = Boolean(process.env.NEW_ADMIN_PASSWORD);
    let newFullName = currentAdmin.full_name;
    let newUsername = currentAdmin.username;
    let newEmail = currentAdmin.email;
    let newPassword = '';

    if (isNonInteractive) {
      newPassword = process.env.NEW_ADMIN_PASSWORD;
      if (process.env.NEW_ADMIN_USERNAME) newUsername = process.env.NEW_ADMIN_USERNAME.trim();
      if (process.env.NEW_ADMIN_EMAIL) newEmail = process.env.NEW_ADMIN_EMAIL.trim();
      if (process.env.NEW_ADMIN_NAME) newFullName = process.env.NEW_ADMIN_NAME.trim();

      const pwdErr = validatePasswordStrength(newPassword);
      if (pwdErr) throw new Error(`Password policy error: ${pwdErr}`);
    } else {
      const session = createPromptSession();
      try {
        console.log('\nPress Enter to keep existing values, or type new values:');
        const inputName = await session.prompt(`  Full Name [${currentAdmin.full_name}]: `);
        if (inputName) newFullName = inputName;

        const inputUser = await session.prompt(`  Username [${currentAdmin.username}]: `);
        if (inputUser) newUsername = inputUser;

        const inputEmail = await session.prompt(`  Email [${currentAdmin.email}]: `);
        if (inputEmail) newEmail = inputEmail;

        console.log('\n  [SECURITY NOTICE] Password characters will NOT appear on screen while you type.');
        const pwd1 = await session.promptHidden('  Enter New Admin Password: ');
        const pwdErr = validatePasswordStrength(pwd1);
        if (pwdErr) {
          throw new Error(`Password complexity error: ${pwdErr}`);
        }

        const pwd2 = await session.promptHidden('  Confirm New Admin Password: ');
        if (pwd1 !== pwd2) {
          throw new Error('Passwords do not match');
        }
        newPassword = pwd1;
      } finally {
        session.close();
      }
    }

    // 2. Validate uniqueness against other users
    const [dupCheck] = await conn.query(
      'SELECT id, username, email FROM users WHERE (LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)) AND id != ?',
      [newUsername, newEmail, currentAdmin.id]
    );
    if (dupCheck.length > 0) {
      throw new Error(`Username "${newUsername}" or email "${newEmail}" is already taken by another account`);
    }

    // 3. Hash the new password using bcrypt
    console.log('\nHashing new password with bcrypt (cost: %d)...', saltRounds);
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);

    // 4. Update the Admin user atomically
    await conn.beginTransaction();
    try {
      await conn.query(
        `UPDATE users
            SET full_name = ?,
                username = ?,
                email = ?,
                password_hash = ?,
                status = 'active',
                updated_at = NOW()
          WHERE id = ?`,
        [newFullName, newUsername.toLowerCase(), newEmail.toLowerCase(), passwordHash, currentAdmin.id]
      );

      // Audit log the credential update
      await conn.query(
        `INSERT INTO audit_logs (user_id, action, table_name, record_id, old_values, new_values)
         VALUES (?, 'UPDATE', 'users', ?, ?, ?)`,
        [
          currentAdmin.id,
          currentAdmin.id,
          JSON.stringify({ username: currentAdmin.username, email: currentAdmin.email }),
          JSON.stringify({ username: newUsername.toLowerCase(), email: newEmail.toLowerCase(), action: 'CREDENTIAL_RESET' }),
        ]
      );

      await conn.commit();

      console.log('\n' + '='.repeat(75));
      console.log('  ADMIN CREDENTIALS UPDATED SUCCESSFULLY');
      console.log('='.repeat(75));
      console.log(`  User ID:   ${currentAdmin.id}`);
      console.log(`  Full Name: ${newFullName}`);
      console.log(`  Username:  ${newUsername.toLowerCase()}`);
      console.log(`  Email:     ${newEmail.toLowerCase()}`);
      console.log(`  Status:    active (failed attempts reset)`);
      console.log('='.repeat(75));
      console.log('\nYou can now log in immediately using these credentials.\n');
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
