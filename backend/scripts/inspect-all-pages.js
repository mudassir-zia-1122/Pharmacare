import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SCREENSHOT_DIR = 'C:\\Users\\DELL\\.gemini\\antigravity\\brain\\20ef6cbd-e666-45b4-a0ef-1f2a714993d3\\screenshots';

const PAGES = [
  { name: 'Dashboard', path: '/dashboard', shot: 'inspect_02_dashboard.png' },
  { name: 'Medicines', path: '/medicines', shot: 'inspect_03_medicines.png' },
  { name: 'Inventory', path: '/inventory', shot: 'inspect_04_inventory.png' },
  { name: 'POS', path: '/pos', shot: 'inspect_05_pos.png' },
  { name: 'Purchases', path: '/purchases', shot: 'inspect_06_purchases.png' },
  { name: 'Suppliers', path: '/suppliers', shot: 'inspect_07_suppliers.png' },
  { name: 'Sales', path: '/sales', shot: 'inspect_08_sales.png' },
  { name: 'Returns', path: '/returns', shot: 'inspect_09_returns.png' },
  { name: 'Prescriptions', path: '/prescriptions', shot: 'inspect_10_prescriptions.png' },
  { name: 'Doctors', path: '/doctors', shot: 'inspect_11_doctors.png' },
  { name: 'Appointments', path: '/appointments', shot: 'inspect_12_appointments.png' },
  { name: 'Reception', path: '/reception', shot: 'inspect_13_reception.png' },
  { name: 'Queue', path: '/appointments/queue', shot: 'inspect_14_queue.png' },
  { name: 'Patients', path: '/patients', shot: 'inspect_15_patients.png' },
  { name: 'Customers', path: '/customers', shot: 'inspect_16_customers.png' },
  { name: 'Finance', path: '/finance', shot: 'inspect_17_finance.png' },
  { name: 'Reports', path: '/reports', shot: 'inspect_18_reports.png' },
  { name: 'Settings', path: '/settings', shot: 'inspect_19_settings.png' },
];

async function inspectApplication() {
  console.log('='.repeat(70));
  console.log('  PharmaCare — Full Browser QA & Route Inspection Audit');
  console.log('='.repeat(70));

  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const consoleErrors = [];
  const networkErrors = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(`[Console Error] ${msg.text()}`);
    }
  });

  page.on('pageerror', err => {
    consoleErrors.push(`[Page Crash] ${err.toString()}`);
  });

  page.on('requestfailed', req => {
    const failure = req.failure();
    const url = req.url();
    if (!url.includes('favicon') && !failure?.errorText?.includes('net::ERR_ABORTED')) {
      networkErrors.push(`[Request Failed] ${req.method()} ${url} (${failure?.errorText})`);
    }
  });

  const auditResults = [];

  try {
    // 1. Inspect Login Page
    console.log('\n[1/3] Inspecting Login Page (http://localhost:5173/login)...');
    await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle2', timeout: 15000 });
    await new Promise(r => setTimeout(r, 600));

    const loginShot = path.join(SCREENSHOT_DIR, 'inspect_01_login.png');
    await page.screenshot({ path: loginShot });

    const loginTitle = await page.title();
    console.log(`  - Login Title: "${loginTitle}"`);
    console.log(`  - Screenshot saved: inspect_01_login.png`);

    // 2. Perform Authenticated Login
    console.log('\n[2/3] Authenticating as Admin (admin / Password123!)...');
    await page.waitForSelector('#identifier', { timeout: 10000 });

    await page.evaluate(() => {
      const idInput = document.querySelector('#identifier');
      const passInput = document.querySelector('#password');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;

      setter.call(idInput, 'admin');
      idInput.dispatchEvent(new Event('input', { bubbles: true }));

      setter.call(passInput, 'Password123!');
      passInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const submitBtn = await page.$('button[type="submit"]');
    await submitBtn.click();

    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
    const currentUrl = page.url();
    console.log(`  - Post-Login URL: ${currentUrl}`);

    if (!currentUrl.includes('/dashboard')) {
      throw new Error(`Authentication failed to redirect to /dashboard. Current URL: ${currentUrl}`);
    }
    console.log('  [OK] Successfully authenticated into PharmaCare.');

    // 3. Inspect Every Page
    console.log('\n[3/3] Inspecting all 18 major application pages:');

    for (const item of PAGES) {
      const fullUrl = `http://localhost:5173${item.path}`;
      const errsBefore = consoleErrors.length;
      const netErrsBefore = networkErrors.length;

      try {
        await page.goto(fullUrl, { waitUntil: 'networkidle2', timeout: 15000 });
        await new Promise(r => setTimeout(r, 800));

        // Gather page details
        const details = await page.evaluate(() => {
          const h1 = document.querySelector('h1')?.innerText?.trim() || '';
          const h2 = document.querySelector('h2')?.innerText?.trim() || '';
          const rootChildren = document.querySelector('#root')?.children?.length || 0;
          const tables = document.querySelectorAll('table').length;
          const rows = document.querySelectorAll('tbody tr').length;
          const cards = document.querySelectorAll('.bg-white, .card, [class*="rounded-"]').length;
          const isBlank = document.body.innerText.trim().length === 0;

          return { h1, h2, rootChildren, tables, rows, cards, isBlank };
        });

        // Screenshot
        const shotPath = path.join(SCREENSHOT_DIR, item.shot);
        await page.screenshot({ path: shotPath });

        const pageErrors = consoleErrors.slice(errsBefore);
        const pageNetErrors = networkErrors.slice(netErrsBefore);

        const status = details.isBlank ? 'BLANK' : (pageErrors.length > 0 ? 'WARN' : 'PASS');
        const heading = details.h1 || details.h2 || item.name;

        console.log(`  - [${status}] ${item.name.padEnd(16)} -> "${heading}" (Tables: ${details.tables}, Rows: ${details.rows})`);

        auditResults.push({
          page: item.name,
          path: item.path,
          status,
          heading,
          details,
          screenshot: item.shot,
          consoleErrors: pageErrors,
          networkErrors: pageNetErrors,
        });
      } catch (err) {
        console.log(`  - [FAIL] ${item.name.padEnd(16)} -> Error: ${err.message}`);
        auditResults.push({
          page: item.name,
          path: item.path,
          status: 'FAIL',
          error: err.message,
        });
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('  INSPECTION SUMMARY');
    console.log('='.repeat(70));
    const passed = auditResults.filter(r => r.status === 'PASS').length;
    const warnings = auditResults.filter(r => r.status === 'WARN').length;
    const failed = auditResults.filter(r => r.status === 'FAIL' || r.status === 'BLANK').length;

    console.log(`Total Pages Inspected: ${auditResults.length}`);
    console.log(`Clean Passes:          ${passed}`);
    console.log(`Warnings/Notices:      ${warnings}`);
    console.log(`Broken/Blank Pages:    ${failed}`);
    console.log('='.repeat(70));

    fs.writeFileSync(
      path.join(SCREENSHOT_DIR, 'inspection_results.json'),
      JSON.stringify({ auditResults, total: auditResults.length, passed, warnings, failed }, null, 2)
    );
  } catch (err) {
    console.error('Inspection failed with fatal error:', err);
  } finally {
    await browser.close();
  }
}

inspectApplication();
