#!/usr/bin/env node
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';

dotenv.config();

async function main() {
  console.log('='.repeat(70));
  console.log('  PharmaCare - TiDB Cloud Database Connection Diagnostic');
  console.log('='.repeat(70));

  const host = process.env.DB_HOST || 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com';
  const port = parseInt(process.env.DB_PORT || '4000', 10);
  const user = process.env.DB_USER || '';
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME || 'test';
  const caPath = process.env.DB_CA_PATH || 'certs/isrgrootx1.pem';

  console.log('\n[1/3] Checking Configuration & SSL Certificate...');
  console.log(`  - Target Host:     ${host}`);
  console.log(`  - Target Port:     ${port}`);
  console.log(`  - User Configured: ${user ? (user.includes('.') ? `${user.split('.')[0]}.***` : '***') : 'EMPTY'}`);
  console.log(`  - Pass Configured: ${password ? 'Yes (Hidden)' : 'EMPTY (Password required in backend/.env)'}`);
  console.log(`  - Target Database: ${database}`);

  let caBuffer = null;
  const resolvedCaPath = path.isAbsolute(caPath) ? caPath : path.resolve(process.cwd(), caPath);
  if (fs.existsSync(resolvedCaPath)) {
    caBuffer = fs.readFileSync(resolvedCaPath);
    console.log(`  - CA Certificate:  Found (${resolvedCaPath})`);
  } else {
    console.log(`  - CA Certificate:  Not found at (${resolvedCaPath}), will use system root trust store`);
  }

  if (!password) {
    console.log('\n[STOPPED] TiDB password is not set in backend/.env.');
    console.log('Please set DB_PASSWORD in backend/.env to run the live test.');
    console.log('='.repeat(70));
    process.exit(0);
  }

  console.log('\n[2/3] Performing Secure TLS Handshake with TiDB Cloud...');
  const sslConfig = {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: true, // Strict validation enforced
  };
  if (caBuffer) {
    sslConfig.ca = caBuffer;
  }

  let connection;
  try {
    connection = await mysql.createConnection({
      host,
      port,
      user,
      password,
      ssl: sslConfig,
      connectTimeout: 15000,
    });
    console.log('  [OK] TLS handshake and authentication successful!');

    console.log('\n[3/3] Querying TiDB Cloud Serverless Details...');
    const [versionRows] = await connection.query('SELECT VERSION() AS version');
    const versionStr = versionRows[0]?.version || 'Unknown';
    console.log(`  - Server Version:  ${versionStr}`);

    const [dbRows] = await connection.query('SHOW DATABASES');
    const existingDbs = dbRows.map(r => Object.values(r)[0]);
    console.log(`  - Available DBs:   ${existingDbs.join(', ')}`);

    const hasAppDb = existingDbs.includes(database);
    if (hasAppDb) {
      console.log(`  - Status for '${database}': Database already exists.`);
    } else {
      console.log(`  - Status for '${database}': Database does not exist yet (ready to be created).`);
    }

    console.log('\n' + '='.repeat(70));
    console.log('  DIAGNOSTIC RESULT: SUCCESS — TiDB Cloud is ready for migration!');
    console.log('='.repeat(70));
    await connection.end();
    process.exit(0);
  } catch (err) {
    console.error('\n  [FAILED] Could not connect to TiDB Cloud:');
    console.error(`  Error Code:    ${err.code || 'N/A'}`);
    console.error(`  Error Message: ${err.message}`);
    console.log('\n' + '='.repeat(70));
    if (connection) await connection.end();
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal diagnostic error:', err.message);
  process.exit(1);
});
