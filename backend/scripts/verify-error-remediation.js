import dotenv from 'dotenv';
dotenv.config({ path: 'backend/.env' });

import jwt from 'jsonwebtoken';
import { query } from '../src/config/db.js';
import { ROLES } from '../src/config/constants.js';

const BASE_API = 'http://localhost:5000/api/v1';
const JWT_SECRET = process.env.JWT_SECRET || 'pharmacare_dev_jwt_secret_key_super_secure_984729487293847293847293847293847298';

const testResults = [];

function assert(condition, testId, description, details = '') {
  if (condition) {
    console.log(`✅ [PASS] [${testId}] ${description} ${details ? '— ' + details : ''}`);
    testResults.push({ id: testId, description, status: 'PASS', details });
  } else {
    console.error(`❌ [FAIL] [${testId}] ${description} — FAILED: ${details}`);
    testResults.push({ id: testId, description, status: 'FAIL', details });
  }
}

async function apiRequest(endpoint, method = 'GET', body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const opts = { method, headers };
  if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
    opts.body = JSON.stringify(body);
  }

  const res = await fetch(`${BASE_API}${endpoint}`, opts);
  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    data = null;
  }
  return { status: res.status, ok: res.ok, data };
}

async function runRemediationVerification() {
  console.log('='.repeat(80));
  console.log('  PharmaCare — Error Remediation & Safe Verification Suite');
  console.log('='.repeat(80));

  let testAdminUserId = null;
  let testCashierUserId = null;
  let testPharmUserId = null;
  let testDoctorId = null;
  let testPatientId = null;
  let createdMedIds = [];
  let createdApptIds = [];
  let createdRxIds = [];

  try {
    // Look up real admin for login test
    const [realAdmin] = await query(
      "SELECT u.id, u.username, u.email FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name = 'admin' AND u.deleted_at IS NULL LIMIT 1"
    );
    if (!realAdmin) throw new Error('No admin user found in database');

    console.log(`\n[SETUP] Verified Admin Account: ${realAdmin.username} (ID: ${realAdmin.id})`);

    // Create ephemeral test roles for RBAC and Token tests
    await query("DELETE FROM users WHERE username LIKE 'test_remed_%'");
    const roleRows = await query("SELECT id, name FROM roles");
    const roleMap = {};
    roleRows.forEach(r => { roleMap[r.name] = r.id; });

    const insCashier = await query(
      `INSERT INTO users (username, email, password_hash, full_name, role_id, status)
       VALUES ('test_remed_cashier', 'cashier.remed@test.com', 'dummy_hash', 'TEST Remed Cashier', ?, 'active')`,
      [roleMap[ROLES.CASHIER] || 4]
    );
    testCashierUserId = insCashier.insertId;

    const insPharm = await query(
      `INSERT INTO users (username, email, password_hash, full_name, role_id, status)
       VALUES ('test_remed_pharm', 'pharm.remed@test.com', 'dummy_hash', 'TEST Remed Pharmacist', ?, 'active')`,
      [roleMap[ROLES.PHARMACIST] || 2]
    );
    testPharmUserId = insPharm.insertId;

    const adminToken = jwt.sign(
      { id: realAdmin.id, username: realAdmin.username, email: realAdmin.email, role: ROLES.ADMIN },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    const cashierToken = jwt.sign(
      { id: testCashierUserId, username: 'test_remed_cashier', role: ROLES.CASHIER },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    const pharmToken = jwt.sign(
      { id: testPharmUserId, username: 'test_remed_pharm', role: ROLES.PHARMACIST },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    // Look up doctor & department for appointment and rx tests
    const docRows = await query("SELECT id, full_name, department_id FROM doctors WHERE status = 'active' LIMIT 1");
    testDoctorId = docRows[0]?.id || 1;

    const insPat = await query(
      `INSERT INTO patients (mrn, full_name, phone, gender, date_of_birth, created_at)
       VALUES (?, 'TEST Remed Patient', '0300-9988776', 'male', '1990-01-01', NOW())`,
      [`MRN-REMED-${Date.now()}`]
    );
    testPatientId = insPat.insertId;

    // -------------------------------------------------------------------------
    // 1. AUTHENTICATION TESTS
    // -------------------------------------------------------------------------
    console.log('\n--- 1. AUTHENTICATION & SETTINGS ACCESS AUDIT ---');

    // 1.1 Public Settings Bootstrap (No Token)
    const pubSettingsRes = await apiRequest('/settings', 'GET');
    assert(
      pubSettingsRes.status === 200 && (pubSettingsRes.data?.data?.pharmacy_name || pubSettingsRes.data?.data?.map?.pharmacy_name || pubSettingsRes.data?.data?.raw),
      'AUTH_01',
      'GET /api/v1/settings without token returns 200 (Public bootstrap)',
      `Pharmacy: ${pubSettingsRes.data?.data?.pharmacy_name || pubSettingsRes.data?.data?.map?.pharmacy_name}`
    );

    // 1.2 Authenticated Settings Read (Admin Token)
    const authSettingsRes = await apiRequest('/settings', 'GET', null, adminToken);
    assert(
      authSettingsRes.status === 200 && authSettingsRes.data?.success === true,
      'AUTH_02',
      'GET /api/v1/settings with valid Admin Bearer token returns 200',
      `Currency: ${authSettingsRes.data?.data?.currency_code || authSettingsRes.data?.data?.map?.currency_code || 'PKR'}`
    );

    // 1.3 Unauthenticated Settings Modification Blocked
    const unauthPostRes = await apiRequest('/settings', 'POST', { pharmacyName: 'Hacked' });
    assert(
      unauthPostRes.status === 401,
      'AUTH_03',
      'POST /api/v1/settings without token rejects with 401 Unauthorized',
      `Message: ${unauthPostRes.data?.message}`
    );

    // 1.4 Non-Admin Settings Modification Blocked (RBAC)
    const cashierPostRes = await apiRequest('/settings', 'POST', { pharmacyName: 'Hacked' }, cashierToken);
    assert(
      cashierPostRes.status === 403,
      'AUTH_04',
      'POST /api/v1/settings with Cashier token rejects with 403 Forbidden',
      `Message: ${cashierPostRes.data?.message}`
    );

    // 1.5 Missing Token on Protected Route (/api/v1/medicines)
    const noTokenRes = await apiRequest('/medicines', 'GET');
    assert(
      noTokenRes.status === 401 && noTokenRes.data?.message?.includes('Authorization header or token query parameter required'),
      'AUTH_05',
      'Protected endpoint rejects missing token with 401',
      `Message: ${noTokenRes.data?.message}`
    );

    // 1.6 Invalid Token Signature
    const bogusTokenRes = await apiRequest('/medicines', 'GET', null, 'invalid_header.invalid_payload.invalid_signature');
    assert(
      bogusTokenRes.status === 401 && bogusTokenRes.data?.message?.includes('Invalid authentication token'),
      'AUTH_06',
      'Protected endpoint rejects corrupt/invalid token with 401',
      `Message: ${bogusTokenRes.data?.message}`
    );

    // 1.7 Expired Token
    const expiredToken = jwt.sign(
      { id: realAdmin.id, role: ROLES.ADMIN },
      JWT_SECRET,
      { expiresIn: '-10s' }
    );
    const expiredRes = await apiRequest('/medicines', 'GET', null, expiredToken);
    assert(
      expiredRes.status === 401 && expiredRes.data?.message?.includes('Session has expired'),
      'AUTH_07',
      'Protected endpoint rejects expired token with 401 Session expired',
      `Message: ${expiredRes.data?.message}`
    );

    // -------------------------------------------------------------------------
    // 2. API ROUTE VERIFICATION (APPOINTMENTS & FINANCE)
    // -------------------------------------------------------------------------
    console.log('\n--- 2. API ROUTE VERIFICATION ---');

    // 2.1 Standard REST Collection: POST /api/v1/appointments
    const today = new Date();
    const apptDate = new Date(today.getTime() + 86400000 * 3).toISOString().slice(0, 10); // 3 days in future

    const restApptRes = await apiRequest('/appointments', 'POST', {
      doctorId: testDoctorId,
      appointmentDate: apptDate,
      appointmentTime: '11:30 AM',
      patientName: 'TEST Rest Appointment',
      patientPhone: '0333-1122334',
      reason: 'Routine Consultation',
    });
    const apptId1 = restApptRes.data?.data?.id || restApptRes.data?.data?.appointment?.id;
    assert(
      restApptRes.status === 201 && apptId1,
      'ROUTE_01',
      'POST /api/v1/appointments collection route successfully creates appointment',
      `Appt ID: ${apptId1}, Token: ${restApptRes.data?.data?.tokenNumber || restApptRes.data?.data?.token?.tokenNumber}`
    );
    if (apptId1) {
      createdApptIds.push(apptId1);
    }

    // 2.2 Book Endpoint Alias: POST /api/v1/appointments/book
    const bookApptRes = await apiRequest('/appointments/book', 'POST', {
      doctorId: testDoctorId,
      appointmentDate: apptDate,
      appointmentTime: '12:00 PM',
      patientName: 'TEST Book Endpoint Alias',
      patientPhone: '0333-5566778',
      reason: 'Follow-up Consultation',
    });
    const apptId2 = bookApptRes.data?.data?.id || bookApptRes.data?.data?.appointment?.id;
    assert(
      bookApptRes.status === 201 && apptId2,
      'ROUTE_02',
      'POST /api/v1/appointments/book alias continues functioning with 201 Created',
      `Appt ID: ${apptId2}`
    );
    if (apptId2) {
      createdApptIds.push(apptId2);
    }

    // 2.3 Finance Daily Summary: GET /api/v1/finance/daily-summary
    const dailySummaryRes = await apiRequest(`/finance/daily-summary?date=${apptDate}`, 'GET', null, adminToken);
    assert(
      dailySummaryRes.status === 200 && dailySummaryRes.data?.data?.expectedCashInDrawer !== undefined,
      'ROUTE_03',
      'GET /api/v1/finance/daily-summary returns cash register & day financial breakdown',
      `Expected Cash: ${dailySummaryRes.data?.data?.expectedCashInDrawer}, Revenue: ${dailySummaryRes.data?.data?.financials?.revenue}`
    );

    // 2.4 Existing Finance Routes Preserved
    const finSummaryRes = await apiRequest('/finance/summary', 'GET', null, adminToken);
    const cashRegRes = await apiRequest('/finance/cash-register', 'GET', null, adminToken);
    assert(
      finSummaryRes.status === 200 && cashRegRes.status === 200,
      'ROUTE_04',
      'GET /finance/summary and /finance/cash-register remain intact',
      `Summary: 200, CashRegister: 200`
    );

    // -------------------------------------------------------------------------
    // 3. EXPECTED NEGATIVE TESTS CLASSIFICATION
    // -------------------------------------------------------------------------
    console.log('\n--- 3. EXPECTED NEGATIVE TEST BEHAVIOR CONFIRMATION ---');

    // 3.1 Double-Booking Slot Collision
    const dupSlotRes = await apiRequest('/appointments', 'POST', {
      doctorId: testDoctorId,
      appointmentDate: apptDate,
      appointmentTime: '11:30 AM', // Same slot as ROUTE_01
      patientName: 'TEST Colliding Patient',
      patientPhone: '0300-1111111',
    });
    assert(
      dupSlotRes.status === 409 && dupSlotRes.data?.message?.includes('already been booked'),
      'NEG_01',
      'Double-booking rejected with 409 Conflict (Expected Security & Integrity check)',
      `Message: ${dupSlotRes.data?.message}`
    );

    // 3.2 Walk-in Missing Required Fields
    const walkInBadRes = await apiRequest('/appointments/walk-in', 'POST', {}, adminToken);
    assert(
      walkInBadRes.status === 400 && walkInBadRes.data?.message?.includes('required'),
      'NEG_02',
      'Walk-in missing required fields rejected with 400 Bad Request',
      `Message: ${walkInBadRes.data?.message}`
    );

    // 3.3 Prescription Missing Patient Name
    const rxNoPatRes = await apiRequest('/prescriptions', 'POST', {
      doctorId: testDoctorId,
      notes: 'No patient name provided',
    }, pharmToken);
    assert(
      rxNoPatRes.status === 400 && rxNoPatRes.data?.message?.includes('Patient name is required'),
      'NEG_03',
      'Prescription missing patient name rejected with 400 Bad Request',
      `Message: ${rxNoPatRes.data?.message}`
    );

    // 3.4 RBAC Restriction: Cashier Attempting Supplier Creation
    const cashierSuppRes = await apiRequest('/suppliers', 'POST', { name: 'Illegal Supplier' }, cashierToken);
    assert(
      cashierSuppRes.status === 403,
      'NEG_04',
      'Cashier creating supplier blocked with 403 Forbidden (RBAC Enforcement)',
      `Message: ${cashierSuppRes.data?.message}`
    );

    // -------------------------------------------------------------------------
    // 4. MEDICINE & PRESCRIPTION VALIDATION NORMALIZATION
    // -------------------------------------------------------------------------
    console.log('\n--- 4. MEDICINE & PRESCRIPTION PAYLOAD NORMALIZATION ---');

    const catRows = await query('SELECT id FROM categories LIMIT 1');
    const doseRows = await query('SELECT id FROM dosage_forms LIMIT 1');
    const catId = catRows[0]?.id || 1;
    const doseId = doseRows[0]?.id || 1;

    // 4.1 Medicine with camelCase Payload
    const medCamelRes = await apiRequest('/medicines', 'POST', {
      genericName: 'TEST Remed Cefixime',
      brandName: 'TEST Remed Caricef',
      categoryId: catId,
      dosageFormId: doseId,
      strength: '400mg',
      reorderLevel: 25,
    }, adminToken);
    assert(
      medCamelRes.status === 201 && medCamelRes.data?.data?.id,
      'NORM_01',
      'Medicine with camelCase fields created with 201 Created',
      `Med ID: ${medCamelRes.data?.data?.id}`
    );
    if (medCamelRes.data?.data?.id) createdMedIds.push(medCamelRes.data.data.id);

    // 4.2 Medicine with snake_case Payload
    const medSnakeRes = await apiRequest('/medicines', 'POST', {
      generic_name: 'TEST Remed Azithromycin',
      brand_name: 'TEST Remed Zithromax',
      category_id: catId,
      dosage_form_id: doseId,
      strength: '250mg',
      reorder_level: 15,
    }, adminToken);
    assert(
      medSnakeRes.status === 201 && medSnakeRes.data?.data?.id,
      'NORM_02',
      'Medicine with snake_case fields created with 201 Created',
      `Med ID: ${medSnakeRes.data?.data?.id}`
    );
    if (medSnakeRes.data?.data?.id) createdMedIds.push(medSnakeRes.data.data.id);

    // 4.3 Prescription with camelCase Payload
    const rxCamelRes = await apiRequest('/prescriptions', 'POST', {
      patientId: testPatientId,
      patientName: 'TEST Camel Patient',
      patientPhone: '0321-4455667',
      doctorId: testDoctorId,
      notes: 'Prescription camelCase test',
    }, adminToken);
    const rxId1 = rxCamelRes.data?.data?.id;
    assert(
      rxCamelRes.status === 201 && rxId1,
      'NORM_03',
      'Prescription with camelCase fields created with 201 Created',
      `Rx ID: ${rxId1}`
    );
    if (rxId1) createdRxIds.push(rxId1);

    // 4.4 Prescription with snake_case Payload
    const rxSnakeRes = await apiRequest('/prescriptions', 'POST', {
      patient_id: testPatientId,
      patient_name: 'TEST Snake Patient',
      patient_phone: '0321-8899001',
      doctor_id: testDoctorId,
      notes: 'Prescription snake_case test',
    }, adminToken);
    const rxId2 = rxSnakeRes.data?.data?.id;
    assert(
      rxSnakeRes.status === 201 && rxId2,
      'NORM_04',
      'Prescription with snake_case fields created with 201 Created',
      `Rx ID: ${rxId2}`
    );
    if (rxId2) createdRxIds.push(rxId2);

  } finally {
    // -------------------------------------------------------------------------
    // CLEANUP OF TEST RECORDS (Preserving real records)
    // -------------------------------------------------------------------------
    console.log('\n--- CLEANUP EPHEMERAL TEST DATA ---');
    try {
      if (createdRxIds.length > 0) {
        await query(`DELETE FROM prescriptions WHERE id IN (${createdRxIds.join(',')})`);
      }
      if (createdApptIds.length > 0) {
        await query(`DELETE FROM appointment_tokens WHERE appointment_id IN (${createdApptIds.join(',')})`);
        await query(`DELETE FROM appointments WHERE id IN (${createdApptIds.join(',')})`);
      }
      if (createdMedIds.length > 0) {
        await query(`DELETE FROM medicines WHERE id IN (${createdMedIds.join(',')})`);
      }
      if (testPatientId) {
        await query("DELETE FROM patients WHERE full_name LIKE 'TEST Remed%'");
      }
      await query("DELETE FROM users WHERE username LIKE 'test_remed_%'");
      console.log('   Ephemeral test records safely purged. Real database records preserved.');
    } catch (e) {
      console.error('Cleanup warning:', e.message);
    }
  }

  console.log('\n' + '='.repeat(80));
  const passed = testResults.filter(r => r.status === 'PASS').length;
  console.log(`  SUMMARY: ${passed} / ${testResults.length} REMEDIATION TESTS PASSED`);
  console.log('='.repeat(80));
}

runRemediationVerification()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Test suite failed:', err);
    process.exit(1);
  });
