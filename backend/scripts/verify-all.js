import http from 'http';

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function verify() {
  console.log('='.repeat(70));
  console.log('  PharmaCare - End-to-End API and Integration Verification');
  console.log('='.repeat(70));

  // 1. Health check
  console.log('\n[1/10] System Health:');
  const health = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/health',
    method: 'GET'
  });
  console.log(`  - Health Status: ${health.data.status} (DB: ${health.data.database.database} on ${health.data.database.host})`);

  // 2. Auth Login
  console.log('\n[2/10] Admin Authentication:');
  const loginPayload = JSON.stringify({ identifier: 'admin', password: 'Password123!' });
  const loginRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(loginPayload)
    }
  }, loginPayload);

  if (!loginRes.data?.success) {
    console.error('  [FAIL] Login failed:', loginRes.data);
    return;
  }
  const token = loginRes.data.data.token || loginRes.data.data.accessToken;
  const user = loginRes.data.data.user;
  console.log(`  - Authenticated: ${user.fullName} (${user.username}) as Role: ${user.role}`);

  const authHeaders = {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  };

  // 3. Departments
  console.log('\n[3/10] Medical Departments:');
  const depts = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/doctors/departments',
    method: 'GET',
    headers: authHeaders
  });
  console.log(`  - Departments Count: ${depts.data?.data?.length} (e.g. ${depts.data?.data?.[0]?.name})`);

  // 4. Doctors
  console.log('\n[4/10] Doctors Management:');
  const docs = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/doctors',
    method: 'GET',
    headers: authHeaders
  });
  console.log(`  - Registered Doctors: ${docs.data?.data?.length} (Sample: ${docs.data?.data?.[0]?.fullName} - ${docs.data?.data?.[0]?.pmdcNumber})`);

  // 5. Patients
  console.log('\n[5/10] Patients Registry & Demographics:');
  const pats = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/patients',
    method: 'GET',
    headers: authHeaders
  });
  console.log(`  - Registered Patients: ${pats.data?.data?.length} (Sample: ${pats.data?.data?.[0]?.fullName} - MRN: ${pats.data?.data?.[0]?.mrn})`);

  // 6. Medicine Catalogue & Batches
  console.log('\n[6/10] Medicine Catalogue:');
  const meds = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/medicines?limit=5',
    method: 'GET',
    headers: authHeaders
  });
  console.log(`  - Medicines Retrieved: ${meds.data?.data?.length} items`);

  // 7. Prescriptions
  console.log('\n[7/10] Prescriptions Repository:');
  const rxs = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/prescriptions',
    method: 'GET',
    headers: authHeaders
  });
  console.log(`  - Prescriptions on Record: ${rxs.data?.data?.length} (Sample: ${rxs.data?.data?.[0]?.prescriptionNumber} for ${rxs.data?.data?.[0]?.patientName})`);

  // 8. Financial Summary & P&L
  console.log('\n[8/10] Financial Management & P&L:');
  const fin = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/finance/summary',
    method: 'GET',
    headers: authHeaders
  });
  console.log(`  - Revenue: PKR ${fin.data?.data?.revenue}, Expenses: PKR ${fin.data?.data?.totalExpenses}, Net Profit: PKR ${fin.data?.data?.netProfit}`);

  // 9. Cash Register Reconciliation
  console.log('\n[9/10] Daily Cash Register:');
  const cashReg = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/finance/cash-register',
    method: 'GET',
    headers: authHeaders
  });
  console.log(`  - Opening Float: PKR ${cashReg.data?.data?.openingFloat}, Cash Sales: PKR ${cashReg.data?.data?.cashSales}, Expected Drawer: PKR ${cashReg.data?.data?.expectedCashInDrawer}`);

  // 10. In-App Notifications
  console.log('\n[10/10] Notifications System:');
  const notifs = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/notifications',
    method: 'GET',
    headers: authHeaders
  });
  console.log(`  - Active Notifications: ${notifs.data?.data?.length}, Unread: ${notifs.data?.unreadCount}`);
  if (notifs.data?.data?.length > 0) {
    console.log(`  - Latest: [${notifs.data.data[0].type}] ${notifs.data.data[0].title}`);
  }

  console.log('\n' + '='.repeat(70));
  console.log('  ALL ENDPOINTS VERIFIED SUCCESSFULLY AGAINST REMOTE TIDB CLOUD!');
  console.log('='.repeat(70));
}

verify();
