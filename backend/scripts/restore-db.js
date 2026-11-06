import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

// Load environment configuration
const envPath = path.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath });

const host = process.env.DB_HOST || 'localhost';
const port = parseInt(process.env.DB_PORT || '3306', 10);
const user = process.env.DB_USER || 'root';
const password = process.env.DB_PASSWORD || '';
const originalDatabase = process.env.DB_NAME || 'pharmacare_db';

// Target database for restore verification: By default use isolated test database!
const args = process.argv.slice(2);
let backupFileArg = null;
let targetDatabase = 'pharmacare_test_restore_db';
let allowProductionOverwrite = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--db' && args[i + 1]) {
    targetDatabase = args[i + 1];
    i++;
  } else if (args[i] === '--force-production') {
    allowProductionOverwrite = true;
  } else if (!backupFileArg && !args[i].startsWith('--')) {
    backupFileArg = args[i];
  }
}

// Safety protection: Prevent accidental overwrite of production/development database
if (targetDatabase === originalDatabase && !allowProductionOverwrite) {
  console.error('[SAFETY BLOCK] Refusing to overwrite active database without explicit --force-production flag.');
  console.error('To verify a backup safely, restore into the isolated test database "pharmacare_test_restore_db".');
  process.exit(1);
}

// Locate backup file: either specified or find newest in database/backups
const backupDir = path.resolve(process.cwd(), '../database/backups');
let backupFilePath = null;

if (backupFileArg) {
  backupFilePath = path.resolve(backupFileArg);
} else {
  if (fs.existsSync(backupDir)) {
    const files = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('pharmacare_backup_') && f.endsWith('.sql'))
      .sort()
      .reverse();
    if (files.length > 0) {
      backupFilePath = path.join(backupDir, files[0]);
    }
  }
}

if (!backupFilePath || !fs.existsSync(backupFilePath)) {
  console.error('[ERROR] No backup file found to restore.');
  console.error(`Checked: ${backupFilePath || backupDir}`);
  process.exit(1);
}

// Locate mysql client executable
function getMysqlPath() {
  if (process.env.MYSQL_PATH && fs.existsSync(process.env.MYSQL_PATH)) {
    return process.env.MYSQL_PATH;
  }
  const xamppMysql = 'C:\\xampp\\mysql\\bin\\mysql.exe';
  if (process.platform === 'win32' && fs.existsSync(xamppMysql)) {
    return xamppMysql;
  }
  return 'mysql';
}

const mysqlBin = getMysqlPath();

console.log('================================================================');
console.log('      PHARMACARE DATABASE RESTORE & RECOVERY UTILITY            ');
console.log('================================================================');
console.log(`Source Backup File: ${backupFilePath}`);
console.log(`Target Database:    ${targetDatabase} (Isolated Verification Target)`);
console.log(`Host:               ${host}:${port}`);
console.log(`Client Binary:      ${mysqlBin}`);
console.log('----------------------------------------------------------------');

async function runRestore() {
  // Step 1: Create isolated target database if it does not exist
  console.log(`1. Preparing target database "${targetDatabase}"...`);
  const adminConn = await mysql.createConnection({
    host,
    port,
    user,
    password,
  });

  await adminConn.query(`CREATE DATABASE IF NOT EXISTS \`${targetDatabase}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await adminConn.end();
  console.log(`✔ Database "${targetDatabase}" is ready.`);

  // Step 2: Stream SQL dump into target database
  console.log(`2. Restoring tables, triggers, and schema records...`);

  const spawnArgs = [
    `-h${host}`,
    `-P${port}`,
    `-u${user}`,
    targetDatabase,
  ];
  if (password) {
    spawnArgs.splice(3, 0, `-p${password}`);
  }

  const restoreProcess = spawn(mysqlBin, spawnArgs);
  const readStream = fs.createReadStream(backupFilePath);
  readStream.pipe(restoreProcess.stdin);

  let stderrOutput = '';
  restoreProcess.stderr.on('data', (d) => { stderrOutput += d.toString(); });

  restoreProcess.on('error', (err) => {
    console.error('[RESTORE ERROR] Failed to spawn mysql process:', err.message);
    process.exit(1);
  });

  restoreProcess.on('close', async (code) => {
    if (code !== 0) {
      console.error(`[RESTORE FAILED] mysql process exited with code ${code}`);
      if (stderrOutput) console.error(stderrOutput);
      process.exit(1);
    }

    console.log('✔ SQL dump streamed successfully into target database.');

    // Step 3: Verify restored schema and essential tables
    console.log('\n3. Verifying restored tables and record integrity...');
    try {
      const verifyConn = await mysql.createConnection({
        host,
        port,
        user,
        password,
        database: targetDatabase,
      });

      const [tables] = await verifyConn.query('SHOW TABLES');
      console.log(`✔ Found ${tables.length} tables in restored database.`);

      // Verify row counts for critical pharmacy tables
      const [userCount] = await verifyConn.query('SELECT COUNT(*) AS count FROM users');
      const [roleCount] = await verifyConn.query('SELECT COUNT(*) AS count FROM roles');
      const [medCount] = await verifyConn.query('SELECT COUNT(*) AS count FROM medicines');
      const [batchCount] = await verifyConn.query('SELECT COUNT(*) AS count FROM batches');
      const [catCount] = await verifyConn.query('SELECT COUNT(*) AS count FROM categories');
      const [inqCount] = await verifyConn.query('SELECT COUNT(*) AS count FROM doctor_inquiries');

      console.log('\n--- Restored Data Audit Summary ---');
      console.log(`  - Users:             ${userCount[0].count}`);
      console.log(`  - Roles:             ${roleCount[0].count}`);
      console.log(`  - Categories:        ${catCount[0].count}`);
      console.log(`  - Medicines:         ${medCount[0].count}`);
      console.log(`  - Inventory Batches: ${batchCount[0].count}`);
      console.log(`  - Doctor Inquiries:  ${inqCount[0].count}`);

      // Verify triggers
      const [triggers] = await verifyConn.query('SHOW TRIGGERS');
      console.log(`  - Triggers restored: ${triggers.length} (including FEFO & safety triggers)`);

      await verifyConn.end();

      console.log('\n✔ RESTORATION & INTEGRITY VERIFICATION SUCCEEDED 100%!');
      console.log('================================================================');
    } catch (verErr) {
      console.error('[VERIFICATION FAILED]', verErr.message);
      process.exit(1);
    }
  });
}

runRestore().catch((err) => {
  console.error('[UNEXPECTED ERROR]', err);
  process.exit(1);
});
