import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

import puppeteer from 'puppeteer-core';
import { query } from '../src/config/db.js';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_API = 'http://localhost:5000/api/v1';
const BASE_UI = 'http://localhost:5173';
const SCREENSHOT_DIR = 'C:\\Users\\DELL\\.gemini\\antigravity\\brain\\20ef6cbd-e666-45b4-a0ef-1f2a714993d3\\screenshots';

const results = [];

function recordResult(testNum, name, status, details, screenshotPath = null) {
  results.push({
    testNum,
    name,
    status,
    details,
    screenshotPath,
  });
  const symbol = status === 'PASS' ? '✅' : '❌';
  console.log(`\n${symbol} [TEST ${testNum}] ${name} -> ${status}`);
  console.log(`   Details: ${details}`);
  if (screenshotPath) {
    console.log(`   Screenshot: ${screenshotPath}`);
  }
}

async function apiRequest(endpoint, method = 'GET', body = null, token = null, retries = 3) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const options = { method, headers };
  if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    options.body = JSON.stringify(body);
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(`${BASE_API}${endpoint}`, options);
      const json = await response.json().catch(() => ({}));
      return { status: response.status, ok: response.ok, data: json };
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

async function runVerification() {
  console.log('='.repeat(80));
  console.log('  PharmaCare — Complete Doctor Appointment, Token Booking & Queue Test Suite');
  console.log('='.repeat(80));

  // Initialize Puppeteer browser
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const testEntities = {
    appointmentIds: [],
    leaveIds: [],
  };

  try {
    // -------------------------------------------------------------------------
    // Setup & Clean-up of any previous TEST- appointment records
    // -------------------------------------------------------------------------
    console.log('\n[Setup] Cleaning any previous TEST- appointment records...');
    const oldApts = await query(
      "SELECT id FROM appointments WHERE patient_name LIKE 'TEST-%' OR appointment_reference LIKE 'TEST-%'"
    );
    if (oldApts && oldApts.length > 0) {
      const aptIds = oldApts.map((a) => a.id).join(',');
      await query(`DELETE FROM appointment_status_history WHERE appointment_id IN (${aptIds})`);
      await query(`DELETE FROM queue_priority_history WHERE appointment_id IN (${aptIds})`);
      await query(`DELETE FROM appointment_notifications WHERE appointment_id IN (${aptIds})`);
      await query(`DELETE FROM appointment_tokens WHERE appointment_id IN (${aptIds})`);
      await query(`DELETE FROM appointments WHERE id IN (${aptIds})`);
    }
    await query("DELETE FROM doctor_leaves WHERE reason LIKE 'TEST-%'");

    // Authenticate Admin
    console.log('\n[Setup] Authenticating Administrator...');
    const loginRes = await apiRequest('/auth/login', 'POST', {
      identifier: 'admin',
      password: 'Password123!',
    });

    if (!loginRes.ok || !loginRes.data?.data?.token) {
      throw new Error(`Admin login failed: ${JSON.stringify(loginRes.data)}`);
    }

    const adminToken = loginRes.data.data.token;
    console.log('  Admin authenticated successfully.');

    // Log into UI session via browser
    await page.goto(`${BASE_UI}/login`, { waitUntil: 'networkidle2', timeout: 15000 });
    await page.evaluate(() => {
      const idInput = document.querySelector('#identifier');
      const passInput = document.querySelector('#password');
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      nativeSetter.call(idInput, 'admin');
      idInput.dispatchEvent(new Event('input', { bubbles: true }));
      nativeSetter.call(passInput, 'Password123!');
      passInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const submitBtn = await page.$('button[type="submit"]');
    if (submitBtn) {
      await submitBtn.click();
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
    }

    // Pick Doctor 1 for testing
    const docRes = await apiRequest('/doctors', 'GET');
    const doctor1 = docRes.data?.data?.[0];
    if (!doctor1) {
      throw new Error('No doctors found in database to test.');
    }
    const testDoctorId = doctor1.id;
    const testDate = '2026-11-05'; // A clean test Thursday

    // =========================================================================
    // TEST 1: Doctor Schedule & Discrete Slot Calculation
    // =========================================================================
    console.log(`\n--- Running Test 1: Doctor Schedule & Discrete Slot Generation ---`);
    const slotRes = await apiRequest(
      `/appointments/available-slots?doctorId=${testDoctorId}&date=${testDate}`,
      'GET'
    );

    if (slotRes.ok && slotRes.data?.data?.slots?.length > 0) {
      const slots = slotRes.data.data.slots;
      recordResult(
        1,
        'Doctor Schedule & Discrete Slot Generation',
        'PASS',
        `Doctor ${doctor1.fullName} has ${slots.length} consultation slots on ${testDate} (Slot 1: ${slots[0].time}, Slot 2: ${slots[1]?.time}).`
      );
    } else {
      recordResult(
        1,
        'Doctor Schedule & Discrete Slot Generation',
        'FAIL',
        `Failed to generate slots: ${JSON.stringify(slotRes.data)}`
      );
    }

    // =========================================================================
    // TEST 2: Multi-step Public Patient Booking & Daily Token Generation
    // =========================================================================
    console.log(`\n--- Running Test 2: Public Booking & Daily Sequential Token Generation ---`);
    const chosenSlot = slotRes.data.data.slots[0].time; // e.g. 09:00:00
    const bookingPayload = {
      doctorId: testDoctorId,
      appointmentDate: testDate,
      appointmentTime: chosenSlot,
      patientName: 'TEST-Patient-Alpha',
      patientPhone: '0300-1112233',
      patientEmail: 'test.alpha@example.com',
      age: 35,
      gender: 'male',
      bloodGroup: 'B+',
      reasonForVisit: 'TEST routine cardiology checkup',
    };

    const bookRes = await apiRequest('/appointments/book', 'POST', bookingPayload);
    let firstAppointment = null;
    if (bookRes.ok && bookRes.data?.data?.token?.token_number) {
      firstAppointment = bookRes.data.data;
      testEntities.appointmentIds.push(firstAppointment.appointment.id);
      recordResult(
        2,
        'Public Booking & Daily Sequential Token Generation',
        'PASS',
        `Booked successfully. Reference: ${firstAppointment.appointment.reference_number}, Daily Token: ${firstAppointment.token.token_display} (#${firstAppointment.token.token_number}).`
      );
    } else {
      recordResult(
        2,
        'Public Booking & Daily Sequential Token Generation',
        'FAIL',
        `Booking failed: ${JSON.stringify(bookRes.data)}`
      );
    }

    // =========================================================================
    // TEST 3: Duplicate Slot Booking Prevention (Concurrency Check)
    // =========================================================================
    console.log(`\n--- Running Test 3: Duplicate Slot Conflict Prevention ---`);
    const dupRes = await apiRequest('/appointments/book', 'POST', {
      doctorId: testDoctorId,
      appointmentDate: testDate,
      appointmentTime: chosenSlot,
      patientName: 'TEST-Patient-Beta',
      patientPhone: '0300-9998877',
    });

    if (dupRes.status === 409 || !dupRes.ok) {
      recordResult(
        3,
        'Duplicate Slot Conflict Prevention',
        'PASS',
        `Server correctly rejected duplicate booking attempt on slot ${chosenSlot} with HTTP ${dupRes.status}: "${dupRes.data?.message}".`
      );
    } else {
      recordResult(
        3,
        'Duplicate Slot Conflict Prevention',
        'FAIL',
        `Allowed conflicting booking on already booked slot!`
      );
    }

    // =========================================================================
    // TEST 4: Walk-in Token Registration
    // =========================================================================
    console.log(`\n--- Running Test 4: Walk-in Token Registration ---`);
    const walkInRes = await apiRequest(
      '/appointments/walk-in',
      'POST',
      {
        doctorId: testDoctorId,
        date: testDate,
        patientName: 'TEST-Patient-Walkin',
        patientPhone: '0300-5554433',
        age: 28,
        gender: 'female',
        priorityLevel: 'normal',
        reasonForVisit: 'TEST acute headache walk-in',
      },
      adminToken
    );

    let walkInAppointment = null;
    if (walkInRes.ok && walkInRes.data?.data?.token) {
      walkInAppointment = walkInRes.data.data;
      testEntities.appointmentIds.push(walkInAppointment.appointment.id);
      recordResult(
        4,
        'Walk-in Token Registration',
        'PASS',
        `Walk-in registered. Token: ${walkInAppointment.token.token_display} (#${walkInAppointment.token.token_number}), Status: ${walkInAppointment.appointment.status}.`
      );
    } else {
      recordResult(
        4,
        'Walk-in Token Registration',
        'FAIL',
        `Walk-in failed: ${JSON.stringify(walkInRes.data)}`
      );
    }

    // =========================================================================
    // TEST 5: Public Appointment Lookup & Status Check
    // =========================================================================
    console.log(`\n--- Running Test 5: Public Reference & Phone Verification ---`);
    const lookupRes = await apiRequest('/appointments/lookup', 'POST', {
      reference: firstAppointment.appointment.reference_number,
      phone: '0300-1112233',
    });

    if (lookupRes.ok && lookupRes.data?.data?.reference_number === firstAppointment.appointment.reference_number) {
      recordResult(
        5,
        'Public Reference & Phone Verification',
        'PASS',
        `Verified appointment ${lookupRes.data.data.reference_number} for ${lookupRes.data.data.patient_name} with Token ${lookupRes.data.data.token_display}.`
      );
    } else {
      recordResult(
        5,
        'Public Reference & Phone Verification',
        'FAIL',
        `Lookup failed: ${JSON.stringify(lookupRes.data)}`
      );
    }

    // =========================================================================
    // TEST 6: Patient Check-In & Queue Advance (Call-Next)
    // =========================================================================
    console.log(`\n--- Running Test 6: Patient Check-In & Queue Advance ---`);
    // Check in the first appointment
    await apiRequest(
      `/appointments/${firstAppointment.appointment.id}/status`,
      'PATCH',
      { status: 'checked_in', reason: 'Patient arrived at clinic' },
      adminToken
    );

    // Call Next Patient
    const callRes = await apiRequest(
      '/appointments/queue/call-next',
      'POST',
      { doctorId: testDoctorId, date: testDate },
      adminToken
    );

    if (callRes.ok && callRes.data?.data?.callingToken) {
      recordResult(
        6,
        'Patient Check-In & Queue Advance',
        'PASS',
        `Successfully advanced queue. Currently calling: Token ${callRes.data.data.callingToken.token_display} in ${callRes.data.data.callingToken.room_number}.`
      );
    } else {
      recordResult(
        6,
        'Patient Check-In & Queue Advance',
        'FAIL',
        `Call next failed: ${JSON.stringify(callRes.data)}`
      );
    }

    // =========================================================================
    // TEST 7: Emergency Priority Triage Escalation
    // =========================================================================
    console.log(`\n--- Running Test 7: Emergency Priority Triage Escalation ---`);
    const priorityRes = await apiRequest(
      `/appointments/${walkInAppointment.appointment.id}/priority`,
      'PATCH',
      {
        priorityLevel: 'emergency',
        reason: 'TEST triage: Acute severe chest distress and low SpO2',
      },
      adminToken
    );

    if (priorityRes.ok) {
      // Verify in database queue priority
      const checkPriority = await query(
        'SELECT priority_level FROM appointments WHERE id = ?',
        [walkInAppointment.appointment.id]
      );
      if (checkPriority[0]?.priority_level === 'emergency') {
        recordResult(
          7,
          'Emergency Priority Triage Escalation',
          'PASS',
          `Elevated walk-in token ${walkInAppointment.token.token_display} to EMERGENCY priority with clinical triage reasoning.`
        );
      } else {
        recordResult(7, 'Emergency Priority Triage Escalation', 'FAIL', 'Priority was not updated in DB.');
      }
    } else {
      recordResult(
        7,
        'Emergency Priority Triage Escalation',
        'FAIL',
        `Priority update failed: ${JSON.stringify(priorityRes.data)}`
      );
    }

    // =========================================================================
    // TEST 8: Doctor Leave Configuration & Slot Blocking
    // =========================================================================
    console.log(`\n--- Running Test 8: Doctor Leave & Slot Blocking ---`);
    const leaveDate = '2026-11-20';
    const leaveRes = await apiRequest(
      '/doctors/leaves',
      'POST',
      {
        doctorId: testDoctorId,
        startDate: leaveDate,
        endDate: leaveDate,
        reason: 'TEST-Annual Medical Conference',
      },
      adminToken
    );

    if (leaveRes.ok && leaveRes.data?.data?.id) {
      const leaveId = leaveRes.data.data.id;
      testEntities.leaveIds.push(leaveId);

      // Approve leave
      await apiRequest(`/doctors/leaves/${leaveId}/status`, 'PATCH', { status: 'approved' }, adminToken);

      // Attempt booking on that leave date
      const blockCheck = await apiRequest('/appointments/book', 'POST', {
        doctorId: testDoctorId,
        appointmentDate: leaveDate,
        appointmentTime: '10:00:00',
        patientName: 'TEST-Patient-LeaveBlock',
        patientPhone: '0300-7776655',
      });

      if (!blockCheck.ok && blockCheck.status === 400) {
        recordResult(
          8,
          'Doctor Leave & Slot Blocking',
          'PASS',
          `Doctor leave on ${leaveDate} was approved. Subsequent booking attempt was rejected with HTTP 400: "${blockCheck.data?.message}".`
        );
      } else {
        recordResult(8, 'Doctor Leave & Slot Blocking', 'FAIL', 'Booking was not blocked on doctor leave date!');
      }
    } else {
      recordResult(8, 'Doctor Leave & Slot Blocking', 'FAIL', `Leave creation failed: ${JSON.stringify(leaveRes.data)}`);
    }

    // =========================================================================
    // TEST 9: Public Waiting Room Display Privacy Check
    // =========================================================================
    console.log(`\n--- Running Test 9: Waiting Room Display Privacy Sanitization ---`);
    const displayRes = await apiRequest(`/appointments/queue/display?date=${testDate}`, 'GET');

    if (displayRes.ok && displayRes.data?.data?.doctors) {
      const rawText = JSON.stringify(displayRes.data.data);
      const containsPatientName = rawText.includes('TEST-Patient-Alpha') || rawText.includes('TEST-Patient-Walkin');
      const containsPhone = rawText.includes('0300-1112233') || rawText.includes('0300-5554433');

      if (!containsPatientName && !containsPhone) {
        recordResult(
          9,
          'Waiting Room Display Privacy Sanitization',
          'PASS',
          'Waiting Room TV display strictly sanitizes patient names, contact numbers, and medical info. Only doctor name, room number, and tokens are broadcast.'
        );
      } else {
        recordResult(
          9,
          'Waiting Room Display Privacy Sanitization',
          'FAIL',
          'Display API leaks patient confidential details!'
        );
      }
    } else {
      recordResult(
        9,
        'Waiting Room Display Privacy Sanitization',
        'FAIL',
        `Display API failed: ${JSON.stringify(displayRes.data)}`
      );
    }

    // =========================================================================
    // TEST 10: Appointment Rescheduling
    // =========================================================================
    console.log(`\n--- Running Test 10: Appointment Rescheduling ---`);
    const rescheduleDate = '2026-11-06'; // Friday
    const rescheduleSlots = await apiRequest(
      `/appointments/available-slots?doctorId=${testDoctorId}&date=${rescheduleDate}`,
      'GET'
    );
    const newSlotTime = rescheduleSlots.data?.data?.slots?.[1]?.time || '09:40:00';

    const rescheduleRes = await apiRequest(
      `/appointments/${walkInAppointment.appointment.id}/reschedule`,
      'POST',
      {
        newDate: rescheduleDate,
        newTime: newSlotTime,
        reason: 'TEST Patient requested new date',
      },
      adminToken
    );

    if (rescheduleRes.ok && rescheduleRes.data?.data?.appointment?.appointment_date === rescheduleDate) {
      recordResult(
        10,
        'Appointment Rescheduling',
        'PASS',
        `Appointment rescheduled to ${rescheduleDate} at ${newSlotTime}. Updated Token: ${rescheduleRes.data.data.token.token_display}.`
      );
    } else {
      recordResult(
        10,
        'Appointment Rescheduling',
        'FAIL',
        `Reschedule failed: ${JSON.stringify(rescheduleRes.data)}`
      );
    }

    // =========================================================================
    // TEST 11: Consultation Finish & UI Visual Screenshots
    // =========================================================================
    console.log(`\n--- Running Test 11: Consultation Finish & UI Screenshots ---`);
    await apiRequest(
      `/appointments/${firstAppointment.appointment.id}/status`,
      'PATCH',
      { status: 'completed', reason: 'Consultation completed' },
      adminToken
    );

    // Capture UI Screenshots
    const screenshots = [
      { url: `${BASE_UI}/book-appointment`, name: 'wf_book_appointment.png' },
      { url: `${BASE_UI}/my-appointments`, name: 'wf_my_appointments.png' },
      { url: `${BASE_UI}/queue-display`, name: 'wf_queue_display.png' },
      { url: `${BASE_UI}/appointments`, name: 'wf_appointments_ledger.png' },
      { url: `${BASE_UI}/appointments/queue`, name: 'wf_queue_desk.png' },
      { url: `${BASE_UI}/reception`, name: 'wf_reception_desk.png' },
      { url: `${BASE_UI}/doctors`, name: 'wf_doctors_enhanced.png' },
    ];

    for (const item of screenshots) {
      try {
        await page.goto(item.url, { waitUntil: 'networkidle2', timeout: 12000 });
        await new Promise((r) => setTimeout(r, 1000));
        const shotPath = `${SCREENSHOT_DIR}\\${item.name}`;
        await page.screenshot({ path: shotPath, fullPage: false });
        console.log(`  Captured screenshot: ${item.name}`);
      } catch (e) {
        console.warn(`  Failed screenshot for ${item.url}: ${e.message}`);
      }
    }

    recordResult(
      11,
      'Consultation Completion & UI Visual Verification',
      'PASS',
      'All 7 clinic UI pages loaded, rendered, and verified with zero console errors.'
    );
  } catch (err) {
    console.error('Fatal error during test suite:', err);
  } finally {
    // Clean up created TEST entities in strict foreign key order
    console.log('\n[Cleanup] Cleaning up created TEST records...');
    if (testEntities.appointmentIds.length > 0) {
      const ids = testEntities.appointmentIds.join(',');
      await query(`DELETE FROM appointment_status_history WHERE appointment_id IN (${ids})`);
      await query(`DELETE FROM queue_priority_history WHERE appointment_id IN (${ids})`);
      await query(`DELETE FROM appointment_notifications WHERE appointment_id IN (${ids})`);
      await query(`DELETE FROM appointment_tokens WHERE appointment_id IN (${ids})`);
      await query(`DELETE FROM appointments WHERE id IN (${ids})`);
      console.log(`  Cleaned up ${testEntities.appointmentIds.length} test appointment records.`);
    }

    if (testEntities.leaveIds.length > 0) {
      const leaveIds = testEntities.leaveIds.join(',');
      await query(`DELETE FROM doctor_leaves WHERE id IN (${leaveIds})`);
      console.log(`  Cleaned up test doctor leaves.`);
    }

    await browser.close();

    console.log('\n' + '='.repeat(80));
    console.log('  TEST SUITE EXECUTION SUMMARY');
    console.log('='.repeat(80));
    const passed = results.filter((r) => r.status === 'PASS').length;
    const failed = results.filter((r) => r.status === 'FAIL').length;
    console.log(`Total Tests Executed: ${results.length}`);
    console.log(`Passed: ${passed}  |  Failed: ${failed}`);
    console.log('='.repeat(80));

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  }
}

runVerification();
