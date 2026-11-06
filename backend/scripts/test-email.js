#!/usr/bin/env node
import dotenv from 'dotenv';
import readline from 'readline';
import emailService from '../src/services/email.service.js';
import { checkDbHealth, getPool } from '../src/config/db.js';

dotenv.config();

function prompt(questionText) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(questionText, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  console.log('='.repeat(72));
  console.log('  PharmaCare Pharmacy — Gmail SMTP Verification & Test Tool');
  console.log('='.repeat(72));

  // 1. Verify Database Connection
  console.log('\n[1/4] Checking TiDB Cloud Database Connection...');
  const dbHealth = await checkDbHealth();
  if (dbHealth.ok) {
    console.log(`  [OK] Connected to database "${dbHealth.database}" on ${dbHealth.host}:${dbHealth.port}`);
  } else {
    console.warn(`  [WARNING] Database unavailable: ${dbHealth.error} (Email logs will not be recorded in DB)`);
  }

  // 2. Inspect Gmail SMTP Environment
  console.log('\n[2/4] Inspecting SMTP Configuration...');
  const status = emailService.getSmtpConfigStatus();
  console.log(`  - Target Host:     ${status.host}`);
  console.log(`  - Port:            ${status.port} (STARTTLS)`);
  console.log(`  - Secure:          ${status.secure}`);
  console.log(`  - Gmail Account:   ${status.userConfigured ? status.userMasked : 'NOT SET'}`);
  console.log(`  - App Password:    ${status.passConfigured ? 'YES (hidden)' : 'EMPTY (pending entry)'}`);
  console.log(`  - From Address:    ${status.emailFrom}`);
  console.log(`  - Notification To: ${status.pharmacyNotificationEmail}`);
  console.log(`  - Mode:            ${status.simulated ? 'SIMULATED (App Password missing in .env)' : 'LIVE SMTP READY'}`);

  // 3. Connection Verification (transporter.verify)
  console.log('\n[3/4] Verifying SMTP Transporter Connection (transporter.verify)...');
  const verifyResult = await emailService.verifyConnection();

  if (verifyResult.success) {
    if (verifyResult.simulated) {
      console.log('  [NOTICE] Simulation Mode Active.');
      console.log('  -> Google App Password (SMTP_PASS) is currently empty in backend/.env.');
      console.log('  -> Emails will be logged safely to console/database without triggering live SMTP errors.');
    } else {
      console.log(`  [OK] ${verifyResult.message}`);
    }
  } else {
    console.error('  [FAILED] SMTP Handshake failed:');
    console.error(`  -> ${verifyResult.error}`);
    console.error('  Tip: Ensure your 16-character Google App Password is correct and 2-Step Verification is enabled.');
  }

  // 4. Safe Test Email Dispatch (Requires Explicit User Consent)
  console.log('\n[4/4] Real Test Email Dispatch:');

  // Check if non-interactive argument was supplied or if we should prompt
  const argRecipient = process.argv[2];
  const autoApprove = process.argv.includes('--yes') || process.argv.includes('-y');

  if (status.simulated && !status.passConfigured) {
    console.log('\n  [SAFETY NOTICE]: Real live email cannot be dispatched yet because');
    console.log('  SMTP_PASS is empty in backend/.env.');
    console.log('  Once you enter your Google App Password in backend/.env, rerun this script');
    console.log('  to send a live test message.\n');
    await closeAndExit(0);
    return;
  }

  let recipient = argRecipient;
  if (!recipient) {
    recipient = await prompt('  Enter recipient email address for test message (e.g. your personal email): ');
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!recipient || !emailRegex.test(recipient)) {
    console.log('  [ABORTED] No valid recipient email provided. No message sent.\n');
    await closeAndExit(0);
    return;
  }

  let approved = autoApprove;
  if (!approved) {
    const confirmation = await prompt(`  Are you sure you want to send a real email to "${recipient}"? (yes/no): `);
    approved = confirmation.toLowerCase() === 'yes' || confirmation.toLowerCase() === 'y';
  }

  if (!approved) {
    console.log('  [CANCELED] Test email sending canceled by user. No message sent.\n');
    await closeAndExit(0);
    return;
  }

  console.log(`\n  Dispatching test email to ${recipient}...`);
  const sendResult = await emailService.sendTestEmail(recipient);

  if (sendResult.success) {
    console.log('  ✔ [DELIVERY SUCCESSFUL]');
    console.log(`  - Recipient:  ${sendResult.recipient}`);
    console.log(`  - Message ID: ${sendResult.messageId}`);
    console.log(`  - Live Send:  ${!sendResult.simulated}`);
    console.log('\n  Please check your inbox (and Spam/Junk folder) to confirm delivery.\n');
  } else {
    console.error('  ✖ [SEND FAILED]');
    console.error(`  - Error: ${sendResult.error}`);
    console.error('  - Credentials were NOT exposed.\n');
  }

  await closeAndExit(0);
}

async function closeAndExit(code = 0) {
  try {
    const pool = getPool();
    if (pool) await pool.end();
  } catch (_) {}
  console.log('='.repeat(72));
  process.exit(code);
}

main().catch(async (err) => {
  console.error('\n[FATAL ERROR]:', err.message);
  await closeAndExit(1);
});
