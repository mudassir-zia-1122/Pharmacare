#!/usr/bin/env node
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';

dotenv.config();

const host = process.env.DB_HOST || 'localhost';
const port = parseInt(process.env.DB_PORT || '3306', 10);
const user = process.env.DB_USER || 'root';
const password = process.env.DB_PASSWORD || '';
const database = process.env.DB_NAME || 'pharmacare_db';
const caPath = process.env.DB_CA_PATH || 'certs/isrgrootx1.pem';

const backupDir = path.resolve(process.cwd(), '../database/backups');
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const backupFilePath = path.join(backupDir, `pharmacare_backup_${timestamp}.sql`);

console.log('================================================================');
console.log('      PHARMACARE DATABASE BACKUP UTILITY (NATIVE NODE.JS)       ');
console.log('================================================================');
console.log(`Target Database:  ${database} on ${host}:${port}`);
console.log(`User:             ${user}`);
console.log(`Destination File: ${backupFilePath}`);
console.log('----------------------------------------------------------------');

async function runBackup() {
  const resolvedCaPath = path.isAbsolute(caPath) ? caPath : path.resolve(process.cwd(), caPath);
  const connConfig = {
    host,
    port,
    user,
    password,
    database,
    connectTimeout: 30000,
  };

  if (process.env.DB_SSL === 'true' || host.includes('tidbcloud.com')) {
    connConfig.ssl = {
      minVersion: 'TLSv1.2',
      rejectUnauthorized: true,
    };
    if (fs.existsSync(resolvedCaPath)) {
      connConfig.ssl.ca = fs.readFileSync(resolvedCaPath);
    }
  }

  const conn = await mysql.createConnection(connConfig);

  try {
    const [tables] = await conn.query('SHOW FULL TABLES');
    console.log(`Found ${tables.length} tables/views in ${database}. Starting dump...`);

    let dump = `-- PharmaCare Database Backup\n-- Database: ${database}\n-- Generated: ${new Date().toISOString()}\n\n`;
    dump += 'SET FOREIGN_KEY_CHECKS=0;\n';
    dump += 'SET NAMES utf8mb4;\n\n';

    for (const row of tables) {
      const keys = Object.keys(row);
      const tableName = row[keys[0]];
      const tableType = row[keys[1]];

      if (tableType === 'VIEW') {
        const [[viewInfo]] = await conn.query(`SHOW CREATE VIEW \`${tableName}\``);
        dump += `-- --------------------------------------------------------\n`;
        dump += `-- View structure for \`${tableName}\`\n`;
        dump += `-- --------------------------------------------------------\n`;
        dump += `DROP VIEW IF EXISTS \`${tableName}\`;\n`;
        dump += `${viewInfo['Create View']};\n\n`;
      } else {
        const [[tableInfo]] = await conn.query(`SHOW CREATE TABLE \`${tableName}\``);
        dump += `-- --------------------------------------------------------\n`;
        dump += `-- Table structure for \`${tableName}\`\n`;
        dump += `-- --------------------------------------------------------\n`;
        dump += `DROP TABLE IF EXISTS \`${tableName}\`;\n`;
        dump += `${tableInfo['Create Table']};\n\n`;

        const [records] = await conn.query(`SELECT * FROM \`${tableName}\``);
        if (records.length > 0) {
          dump += `-- Dumping data for table \`${tableName}\` (${records.length} records)\n`;
          for (const rec of records) {
            const colNames = Object.keys(rec).map((col) => `\`${col}\``).join(', ');
            const colValues = Object.values(rec).map((val) => {
              if (val === null) return 'NULL';
              if (typeof val === 'number') return val;
              if (typeof val === 'boolean') return val ? 1 : 0;
              if (val instanceof Date) return `'${val.toISOString().slice(0, 19).replace('T', ' ')}'`;
              return conn.escape(typeof val === 'object' ? JSON.stringify(val) : String(val));
            }).join(', ');
            dump += `INSERT INTO \`${tableName}\` (${colNames}) VALUES (${colValues});\n`;
          }
          dump += '\n';
        }
      }
    }

    dump += 'SET FOREIGN_KEY_CHECKS=1;\n';
    fs.writeFileSync(backupFilePath, dump, 'utf8');

    const stats = fs.statSync(backupFilePath);
    const sizeKb = (stats.size / 1024).toFixed(2);
    console.log(`✔ Backup completed successfully!`);
    console.log(`✔ File Size: ${sizeKb} KB`);
    console.log(`✔ Saved to:  ${backupFilePath}`);
  } finally {
    await conn.end();
  }
}

runBackup().catch((err) => {
  console.error('[BACKUP FAILED]:', err.message);
  if (fs.existsSync(backupFilePath)) {
    fs.unlinkSync(backupFilePath);
  }
  process.exit(1);
});
