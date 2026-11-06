import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const ROUTES_TO_TEST = [
  { name: 'Dashboard', path: '/dashboard' },
  { name: 'Medicines Catalogue', path: '/medicines' },
  { name: 'Inventory & Batches', path: '/inventory' },
  { name: 'Medicine Categories', path: '/medicines/categories' },
  { name: 'Suppliers Directory', path: '/suppliers' },
  { name: 'Customers Management', path: '/customers' },
  { name: 'Doctors & Specialists', path: '/doctors' },
  { name: 'Patients Registry', path: '/patients' },
  { name: 'Prescription Records', path: '/prescriptions' },
  { name: 'Sales Ledger', path: '/sales' },
  { name: 'POS Dispensary Terminal', path: '/pos' },
  { name: 'Purchase Orders', path: '/purchases' },
  { name: 'Financial & Accounting', path: '/finance' },
  { name: 'Inquiries Clinical Desk', path: '/inquiries' },
  { name: 'Reports & Analytics', path: '/reports' },
  { name: 'User Management (RBAC)', path: '/users' },
  { name: 'System Settings', path: '/settings' },
];

async function runBrowserVerification() {
  console.log('='.repeat(70));
  console.log('  PharmaCare — Automated Browser Verification & Console Audit');
  console.log('='.repeat(70));

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  const consoleErrors = [];
  const networkFailures = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(`[Console Error] ${msg.text()}`);
    }
  });

  page.on('pageerror', err => {
    consoleErrors.push(`[Page Uncaught Error] ${err.toString()}`);
  });

  page.on('requestfailed', req => {
    if (!req.url().includes('favicon') && !req.failure()?.errorText?.includes('net::ERR_ABORTED')) {
      networkFailures.push(`[Request Failed] ${req.method()} ${req.url()} (${req.failure()?.errorText})`);
    }
  });

  try {
    // 1. Navigate to Login Page
    console.log('\n[1/3] Loading Login Page (http://localhost:5173/login)...');
    await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle2', timeout: 15000 });

    const title = await page.title();
    console.log(`  - Page Title: "${title}"`);

    // 2. Perform Admin Login
    console.log('\n[2/3] Performing Admin Authentication (admin / Password123!)...');
    await page.waitForSelector('#identifier', { timeout: 10000 });

    // Use React-friendly value setting
    await page.evaluate(() => {
      const idInput = document.querySelector('#identifier');
      const passInput = document.querySelector('#password');

      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;

      nativeInputValueSetter.call(idInput, 'admin');
      idInput.dispatchEvent(new Event('input', { bubbles: true }));

      nativeInputValueSetter.call(passInput, 'Password123!');
      passInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await new Promise(r => setTimeout(r, 200));

    // Click submit button
    const submitBtn = await page.$('button[type="submit"]');
    await submitBtn.click();

    // Wait for URL to change to /dashboard
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
    const currentUrl = page.url();
    console.log(`  - Post-Login URL: ${currentUrl}`);

    if (!currentUrl.includes('/dashboard')) {
      const alertText = await page.evaluate(() => {
        const el = document.querySelector('.text-red-700, [role="alert"]');
        return el ? el.innerText : 'Unknown login state';
      });
      console.error(`  [FAIL] Failed to reach dashboard. Screen notice: ${alertText}`);
      await browser.close();
      return;
    }
    console.log('  [OK] Successfully logged in as System Administrator!');

    // 3. Sequentially verify each module route
    console.log('\n[3/3] Auditing all 17 Application Routes in Browser:');
    const results = [];

    for (const route of ROUTES_TO_TEST) {
      const fullUrl = `http://localhost:5173${route.path}`;
      const pageErrorsBefore = consoleErrors.length;
      const netErrorsBefore = networkFailures.length;

      try {
        await page.goto(fullUrl, { waitUntil: 'networkidle2', timeout: 15000 });
        await new Promise(r => setTimeout(r, 800));

        const pageTitleText = await page.evaluate(() => {
          const h1 = document.querySelector('h1');
          return h1 ? h1.innerText.trim() : document.title;
        });

        const newPageErrors = consoleErrors.slice(pageErrorsBefore);
        const newNetErrors = networkFailures.slice(netErrorsBefore);

        const status = newPageErrors.length === 0 ? 'PASS' : 'WARN';
        console.log(`  - [${status}] ${route.name.padEnd(25)} -> "${pageTitleText}"`);

        results.push({
          name: route.name,
          path: route.path,
          status,
          title: pageTitleText,
          errors: newPageErrors,
          netErrors: newNetErrors,
        });
      } catch (err) {
        console.log(`  - [FAIL] ${route.name.padEnd(25)} -> ${err.message}`);
        results.push({
          name: route.name,
          path: route.path,
          status: 'FAIL',
          error: err.message,
        });
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('  BROWSER VERIFICATION SUMMARY');
    console.log('='.repeat(70));
    const passed = results.filter(r => r.status === 'PASS').length;
    const warnings = results.filter(r => r.status === 'WARN').length;
    const failed = results.filter(r => r.status === 'FAIL').length;

    console.log(`Total Routes Tested: ${results.length}`);
    console.log(`Clean Passes:        ${passed}`);
    console.log(`Warnings/Notices:    ${warnings}`);
    console.log(`Broken Pages:        ${failed}`);

    if (consoleErrors.length > 0) {
      console.log('\nDetected Console Notices/Errors:');
      consoleErrors.forEach(e => console.log('  ' + e));
    } else {
      console.log('\nZero JavaScript Console Errors Detected across all pages.');
    }

    if (networkFailures.length > 0) {
      console.log('\nDetected Network Failures:');
      networkFailures.forEach(e => console.log('  ' + e));
    } else {
      console.log('Zero Failed API Requests.');
    }

    console.log('='.repeat(70));
  } catch (err) {
    console.error('[BROWSER RUNTIME ERROR]:', err);
  } finally {
    await browser.close();
  }
}

runBrowserVerification();
