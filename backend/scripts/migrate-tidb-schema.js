import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

// Safety validation: Ensure we are targeting ONLY the remote TiDB Cloud database
const targetHost = process.env.DB_HOST || '';
const targetDb = process.env.DB_NAME || '';

if (!targetHost.includes('tidbcloud.com')) {
  console.error('[ABORT] Target host is not TiDB Cloud! Host:', targetHost);
  process.exit(1);
}

if (targetDb !== 'pharmacare') {
  console.error('[ABORT] Target DB is not pharmacare! DB:', targetDb);
  process.exit(1);
}

function parseSqlStatements(sqlContent) {
  // If there's a DELIMITER block (triggers section), cut it off completely
  let contentToParse = sqlContent;
  const delimiterIdx = contentToParse.indexOf('DELIMITER');
  if (delimiterIdx !== -1) {
    contentToParse = contentToParse.slice(0, delimiterIdx);
  }

  // Strip block comments /* ... */
  let cleaned = contentToParse.replace(/\/\*[\s\S]*?\*\//g, '');

  // Strip single-line comments (-- ...)
  cleaned = cleaned.replace(/--.*$/gm, '');

  // Split into raw statements by semicolon
  const rawStatements = cleaned.split(';');
  const statements = [];

  for (let stmt of rawStatements) {
    stmt = stmt.trim();
    if (!stmt) continue;

    // Skip CREATE DATABASE statements
    if (/^CREATE\s+DATABASE/i.test(stmt)) continue;

    // Skip USE statements
    if (/^USE\s+/i.test(stmt)) continue;

    statements.push(stmt);
  }

  return statements;
}

async function runMigration() {
  console.log('='.repeat(70));
  console.log('  PharmaCare — Remote TiDB Cloud Schema & Migration Import');
  console.log('='.repeat(70));
  console.log(`[Safety Check] Target Host:     ${targetHost}`);
  console.log(`[Safety Check] Target Database: ${targetDb}`);
  console.log(`[Safety Check] Mode:            NON-DESTRUCTIVE (No DROP/TRUNCATE/Seed)`);

  const caPath = process.env.DB_CA_PATH || 'certs/isrgrootx1.pem';
  const resolvedCaPath = path.isAbsolute(caPath) ? caPath : path.resolve(process.cwd(), caPath);
  const sslConfig = fs.existsSync(resolvedCaPath)
    ? { ca: fs.readFileSync(resolvedCaPath), minVersion: 'TLSv1.2', rejectUnauthorized: true }
    : false;

  const conn = await mysql.createConnection({
    host: targetHost,
    port: parseInt(process.env.DB_PORT || '4000', 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: targetDb,
    ssl: sslConfig,
    multipleStatements: true,
  });

  try {
    // Double check current database on connection
    const [[dbCheck]] = await conn.query('SELECT DATABASE() AS currentDb;');
    console.log(`[Connected] Current Database on remote server: ${dbCheck.currentDb}`);
    if (dbCheck.currentDb !== 'pharmacare') {
      throw new Error(`Unexpected database active: ${dbCheck.currentDb}`);
    }

    // 1. Core Schema from database/schema.sql
    console.log('\n--- 1. Importing database/schema.sql (Core Schema) ---');
    const schemaSql = fs.readFileSync(path.resolve(process.cwd(), '../database/schema.sql'), 'utf8');
    const schemaStmts = parseSqlStatements(schemaSql);
    console.log(`Extracted ${schemaStmts.length} valid DDL statements (triggers & local DB statements excluded).`);

    let schemaExecuted = 0;
    for (const stmt of schemaStmts) {
      const preview = stmt.split('\n')[0].substring(0, 60);
      try {
        await conn.query(stmt);
        schemaExecuted++;
      } catch (err) {
        console.error(`[ERROR executing statement]:\n${stmt}\n-> ${err.message}`);
        throw err;
      }
    }
    console.log(`[OK] Successfully executed ${schemaExecuted} schema statements.`);

    // 2. Migration 001 from database/migrations/001_inquiries_and_categories.sql
    console.log('\n--- 2. Importing Migration 001 (Inquiries & Categories) ---');
    const migrationSql = fs.readFileSync(path.resolve(process.cwd(), '../database/migrations/001_inquiries_and_categories.sql'), 'utf8');
    const migrationStmts = parseSqlStatements(migrationSql);
    console.log(`Extracted ${migrationStmts.length} valid migration statements.`);

    let migrationExecuted = 0;
    for (const stmt of migrationStmts) {
      // If role_permissions is referenced but roles are empty, skip role_permissions mapping
      if (/INSERT.*INTO.*role_permissions/i.test(stmt)) {
        console.log('  [Skipped role_permissions mapping until roles are seeded]');
        continue;
      }
      try {
        await conn.query(stmt);
        migrationExecuted++;
      } catch (err) {
        console.error(`[ERROR executing migration statement]:\n${stmt}\n-> ${err.message}`);
        throw err;
      }
    }
    console.log(`[OK] Successfully executed ${migrationExecuted} migration statements.`);

    // 3. Verification of Remote Tables & Views
    console.log('\n--- 3. Verifying Remote TiDB Tables & Views ---');
    const [tableRows] = await conn.query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE';");
    const [viewRows] = await conn.query("SHOW FULL TABLES WHERE Table_type = 'VIEW';");

    console.log(`Total BASE TABLES created: ${tableRows.length}`);
    console.log(`Total VIEWS created:       ${viewRows.length}`);

    // Verify row counts across all tables to confirm ZERO seed data was imported
    console.log('\nTable verification and row count audit:');
    let totalRows = 0;
    for (const row of tableRows) {
      const tableName = Object.values(row)[0];
      const [[cnt]] = await conn.query(`SELECT COUNT(*) AS c FROM \`${tableName}\`;`);
      const rowCount = cnt.c;
      totalRows += (tableName === 'categories' || tableName === 'dosage_forms' || tableName === 'permissions') ? 0 : rowCount;
      console.log(`  - ${tableName.padEnd(26)} : ${rowCount} rows`);
    }

    console.log('\nView verification:');
    for (const row of viewRows) {
      const viewName = Object.values(row)[0];
      console.log(`  - [VIEW] ${viewName}`);
    }

    console.log('\n[Seed Data Audit]');
    const [[userCount]] = await conn.query('SELECT COUNT(*) AS c FROM users;');
    const [[batchCount]] = await conn.query('SELECT COUNT(*) AS c FROM batches;');
    const [[medCount]] = await conn.query('SELECT COUNT(*) AS c FROM medicines;');
    console.log(`  - Users table count:     ${userCount.c} (0 expected)`);
    console.log(`  - Batches table count:   ${batchCount.c} (0 expected)`);
    console.log(`  - Medicines table count: ${medCount.c} (0 expected)`);

    if (userCount.c === 0 && batchCount.c === 0 && medCount.c === 0) {
      console.log('  [CONFIRMED] No demo accounts, batches, or sample inventory imported.');
    } else {
      console.warn('  [WARNING] Unexpected records detected!');
    }

    console.log('\n' + '='.repeat(70));
    console.log('  PHASE 3 STEP 5: SCHEMA & MIGRATION IMPORT COMPLETED SUCCESSFULLY');
    console.log('='.repeat(70));
  } finally {
    await conn.end();
  }
}

runMigration().catch(err => {
  console.error('\n[FATAL MIGRATION ERROR]:', err.message);
  process.exit(1);
});
