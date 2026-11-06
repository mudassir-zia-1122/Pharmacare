import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import emailService, {
  getFromAddress,
  getPharmacyNotificationEmail,
  validateSmtpConfig,
  getSmtpConfigStatus,
  verifyConnection,
  sendInquiryConfirmation,
  sendPharmacyNewInquiryNotification,
  sendAvailabilityResponse,
  sendTestEmail,
} from '../services/email.service.js';
import { query, getPool } from '../config/db.js';

after(async () => {
  try {
    await getPool().end();
  } catch (_) {}
});

test('Email Service - Resolves sender address and pharmacy notification email', () => {
  const from = getFromAddress();
  assert.ok(from.length > 0, 'Sender address must be non-empty');
  assert.match(from, /PharmaCare|pharmacare/i, 'Sender address should reference PharmaCare');

  const pharmacyEmail = getPharmacyNotificationEmail();
  assert.ok(pharmacyEmail.length > 0, 'Pharmacy notification email must be non-empty');
  assert.match(pharmacyEmail, /@/, 'Pharmacy notification email must be a valid email structure');
});

test('Email Service - SMTP Configuration Validation', () => {
  // Test valid baseline configuration
  const validCheck = validateSmtpConfig();
  assert.ok(typeof validCheck.isValid === 'boolean');
  assert.ok(Array.isArray(validCheck.issues));
});

test('Email Service - Safe Config Status masks user and hides password', () => {
  const status = getSmtpConfigStatus();
  assert.ok(typeof status.configured === 'boolean');
  assert.ok(typeof status.simulated === 'boolean');
  assert.ok(status.host, 'Host should be present');
  assert.ok(status.port, 'Port should be present');
  assert.ok(typeof status.userConfigured === 'boolean');
  assert.ok(typeof status.passConfigured === 'boolean');
  assert.strictEqual(status.pass, undefined, 'Password must never be exposed in status object');
});

test('Email Service - verifyConnection in simulated development mode', async () => {
  const conn = await verifyConnection();
  assert.strictEqual(conn.success, true);
  assert.ok(conn.message.length > 0);
});

test('Email Service - sendTestEmail dispatches and records in email_logs', async () => {
  const testRecipient = 'test.physician@clinic.org';
  const result = await sendTestEmail(testRecipient);

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.recipient, testRecipient);
  assert.ok(result.messageId);

  // Verify database record in email_logs
  const [log] = await query(
    'SELECT * FROM email_logs WHERE recipient_email = ? ORDER BY id DESC LIMIT 1',
    [testRecipient]
  );
  assert.ok(log, 'Record should exist in email_logs');
  assert.strictEqual(log.recipient_email, testRecipient);
  assert.strictEqual(log.status, 'sent');
  assert.match(log.subject, /SMTP Test Email/);

  // Clean up isolated test log
  await query('DELETE FROM email_logs WHERE id = ?', [log.id]);
});

// Helper functions for isolated test fixtures obeying foreign keys
async function createTestInquiry(ref, overrides = {}) {
  const result = await query(
    `INSERT INTO doctor_inquiries (
       reference_no, doctor_name, clinic_hospital_name, email, phone, manual_notes, status
     ) VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
    [
      ref,
      overrides.doctor_name || 'Dr. Test Physician',
      overrides.clinic_hospital_name || 'Test City Hospital',
      overrides.email || 'dr.test@hospital.pk',
      overrides.phone || '0300-1111111',
      overrides.manual_notes || 'Test inquiry notes',
    ]
  );
  return result.insertId;
}

async function cleanupTestInquiry(inquiryId) {
  if (!inquiryId) return;
  // Cleanup in correct foreign key order: child (email_logs) first, then parent (doctor_inquiries)
  await query('DELETE FROM email_logs WHERE inquiry_id = ?', [inquiryId]);
  await query('DELETE FROM doctor_inquiries WHERE id = ?', [inquiryId]);
}

test('Email Service - sendInquiryConfirmation logs properly to database', async () => {
  const testRef = `INQ-TEST-CONF-${Date.now()}`;
  const inquiryId = await createTestInquiry(testRef, {
    email: 'dr.test@hospital.pk',
    doctor_name: 'Dr. Test Physician',
    clinic_hospital_name: 'Test City Hospital',
  });

  try {
    const mockInquiry = {
      id: inquiryId,
      reference_no: testRef,
      doctor_name: 'Dr. Test Physician',
      clinic_hospital_name: 'Test City Hospital',
      email: 'dr.test@hospital.pk',
    };

    const result = await sendInquiryConfirmation(mockInquiry);
    assert.strictEqual(result.success, true);
    assert.ok(result.messageId);

    const [log] = await query(
      'SELECT * FROM email_logs WHERE inquiry_id = ? AND recipient_email = ? ORDER BY id DESC LIMIT 1',
      [mockInquiry.id, mockInquiry.email]
    );
    assert.ok(log, 'Inquiry confirmation should be logged');
    assert.strictEqual(log.status, 'sent');
    assert.match(log.subject, new RegExp(testRef));
  } finally {
    await cleanupTestInquiry(inquiryId);
  }
});

test('Email Service - sendPharmacyNewInquiryNotification notifies pharmacy email', async () => {
  const testRef = `INQ-TEST-ALERT-${Date.now()}`;
  const inquiryId = await createTestInquiry(testRef, {
    email: 'sarah.khan@akuh.edu',
    doctor_name: 'Dr. Sarah Khan',
    clinic_hospital_name: 'Aga Khan University Hospital',
    phone: '0300-1234567',
    manual_notes: 'Urgent stock query for Cefixime 400mg',
  });

  try {
    const mockInquiry = {
      id: inquiryId,
      reference_no: testRef,
      doctor_name: 'Dr. Sarah Khan',
      clinic_hospital_name: 'Aga Khan University Hospital',
      email: 'sarah.khan@akuh.edu',
      phone: '0300-1234567',
      manual_notes: 'Urgent stock query for Cefixime 400mg',
      has_image: true,
    };

    const pharmacyEmail = getPharmacyNotificationEmail();
    const result = await sendPharmacyNewInquiryNotification(mockInquiry);
    assert.strictEqual(result.success, true);
    assert.ok(result.messageId);

    const [log] = await query(
      'SELECT * FROM email_logs WHERE inquiry_id = ? AND recipient_email = ? ORDER BY id DESC LIMIT 1',
      [mockInquiry.id, pharmacyEmail]
    );
    assert.ok(log, 'Pharmacy notification should be logged');
    assert.strictEqual(log.status, 'sent');
    assert.match(log.subject, new RegExp(testRef));
  } finally {
    await cleanupTestInquiry(inquiryId);
  }
});

test('Email Service - sendAvailabilityResponse formats itemized availability', async () => {
  const testRef = `INQ-TEST-AVAIL-${Date.now()}`;
  const inquiryId = await createTestInquiry(testRef, {
    email: 'dr.tariq@hospital.org',
    doctor_name: 'Dr. Tariq Mahmood',
    clinic_hospital_name: 'Civil Hospital',
  });

  try {
    const mockInquiry = {
      id: inquiryId,
      reference_no: testRef,
      doctor_name: 'Dr. Tariq Mahmood',
      clinic_hospital_name: 'Civil Hospital',
      email: 'dr.tariq@hospital.org',
    };

    const items = [
      {
        item_name_raw: 'Augmentin 625mg',
        availability_status: 'available',
        available_quantity: 50,
        notes: 'Batch EXP-2027',
      },
      {
        item_name_raw: 'Panadol 500mg',
        availability_status: 'out_of_stock',
        available_quantity: 0,
        notes: 'Expected next week',
      },
    ];

    const result = await sendAvailabilityResponse(mockInquiry, items, 'Verified against active inventory.');
    assert.strictEqual(result.success, true);

    const [log] = await query(
      'SELECT * FROM email_logs WHERE inquiry_id = ? AND recipient_email = ? ORDER BY id DESC LIMIT 1',
      [mockInquiry.id, mockInquiry.email]
    );
    assert.ok(log, 'Availability email must be recorded in email_logs');
    assert.strictEqual(log.status, 'sent');
    assert.match(log.body_text, /Augmentin 625mg/);
    assert.match(log.body_text, /Panadol 500mg/);
  } finally {
    await cleanupTestInquiry(inquiryId);
  }
});
