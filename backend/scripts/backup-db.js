import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import dotenv from 'dotenv';

// Load environment configuration
const envPath = path.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath });

const host = process.env.DB_HOST || 'localhost';
const port = process.env.DB_PORT || '3306';
const user = process.env.DB_USER || 'root';
const password = process.env.DB_PASSWORD || '';
const database = process.env.DB_NAME || 'pharmacare_db';

// Ensure backup destination directory exists outside web root
const backupDir = path.resolve(process.cwd(), '../database/backups');
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

// Generate timestamped filename: pharmacare_backup_YYYYMMDD_HHMMSS.sql
const now = new Date();
const timestamp = now.toISOString()
  .replace(/[-:]/g, '')
  .replace('T', '_')
  .slice(0, 15);
const backupFilename = `pharmacare_backup_${timestamp}.sql`;
const backupFilePath = path.join(backupDir, backupFilename);

// Locate mysqldump executable
function getMysqldumpPath() {
  if (process.env.MYSQLDUMP_PATH && fs.existsSync(process.env.MYSQLDUMP_PATH)) {
    return process.env.MYSQLDUMP_PATH;
  }
  const xamppDump = 'C:\\xampp\\mysql\\bin\\mysqldump.exe';
  if (process.platform === 'win32' && fs.existsSync(xamppDump)) {
    return xamppDump;
  }
  return 'mysqldump';
}

const mysqldumpBin = getMysqldumpPath();

console.log('================================================================');
console.log('      PHARMACARE DATABASE BACKUP UTILITY (PHASE 8)              ');
console.log('================================================================');
console.log(`Target Database:  ${database} on ${host}:${port}`);
console.log(`User:             ${user}`);
console.log(`Destination File: ${backupFilePath}`);
console.log(`Engine:           ${mysqldumpBin}`);
console.log('----------------------------------------------------------------');

const caPath = process.env.DB_CA_PATH || 'certs/isrgrootx1.pem';
const resolvedCaPath = path.isAbsolute(caPath) ? caPath : path.resolve(process.cwd(), caPath);

const args = [
  `-h${host}`,
  `-P${port}`,
  `-u${user}`,
  '--single-transaction',
  '--quick',
  '--routines',
  '--triggers',
  '--events',
  '--add-drop-table',
  database,
];

if (process.env.DB_SSL === 'true' || host.includes('tidbcloud.com')) {
  args.splice(3, 0, '--ssl');
  if (fs.existsSync(resolvedCaPath)) {
    args.splice(4, 0, `--ssl-ca=${resolvedCaPath}`);
  }
}

if (password) {
  args.splice(3, 0, `-p${password}`);
}

const writeStream = fs.createWriteStream(backupFilePath);
const dumpProcess = spawn(mysqldumpBin, args);

dumpProcess.stdout.pipe(writeStream);

let stderrOutput = '';
dumpProcess.stderr.on('data', (data) => {
  stderrOutput += data.toString();
});

dumpProcess.on('error', (err) => {
  console.error('[BACKUP ERROR] Failed to spawn mysqldump process:', err.message);
  if (fs.existsSync(backupFilePath)) {
    fs.unlinkSync(backupFilePath);
  }
  process.exit(1);
});

dumpProcess.on('close', (code) => {
  if (code !== 0) {
    console.error(`[BACKUP FAILED] mysqldump exited with error code ${code}`);
    if (stderrOutput) console.error(stderrOutput);
    if (fs.existsSync(backupFilePath)) {
      fs.unlinkSync(backupFilePath);
    }
    process.exit(1);
  }

  const stats = fs.statSync(backupFilePath);
  const sizeKb = (stats.size / 1024).toFixed(2);

  if (stats.size < 1000) {
    console.error('[BACKUP ERROR] Generated backup file is suspiciously small (< 1KB).');
    process.exit(1);
  }

  console.log(`✔ Backup completed successfully!`);
  console.log(`✔ File Size: ${sizeKb} KB`);
  console.log(`✔ Saved to:  ${backupFilePath}`);

  // Retention cleanup: prune backups older than 30 days
  const retentionDays = parseInt(process.env.BACKUP_RETENTION_DAYS || '30', 10);
  console.log(`\nChecking retention policy (${retentionDays} days retention)...`);
  try {
    const files = fs.readdirSync(backupDir);
    const nowMs = Date.now();
    const maxAgeMs = retentionDays * 24 * 60 * 60 * 1000;
    let prunedCount = 0;

    for (const f of files) {
      if (f.startsWith('pharmacare_backup_') && f.endsWith('.sql')) {
        const fp = path.join(backupDir, f);
        const fstat = fs.statSync(fp);
        if (nowMs - fstat.mtimeMs > maxAgeMs) {
          fs.unlinkSync(fp);
          prunedCount++;
          console.log(`  - Pruned aged backup: ${f}`);
        }
      }
    }
    if (prunedCount === 0) {
      console.log('  - All backups within retention window. No pruning required.');
    }
  } catch (cleanErr) {
    console.warn('  - Retention cleanup warning:', cleanErr.message);
  }

  console.log('================================================================');
});
