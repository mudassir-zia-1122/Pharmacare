import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import jwt from 'jsonwebtoken';
import app from '../app.js';
import { getJwtSecret } from '../config/security.js';
import { checkDbHealth, resetPool } from '../config/db.js';

after(async () => {
  await resetPool();
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SERVER_PATH = path.resolve(__dirname, '../server.js');

/**
 * Starts the Express app on an ephemeral localhost port for real HTTP integration testing.
 */
async function withTestServer(fn) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    await fn(baseUrl);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

/**
 * Spawns backend/src/server.js in an isolated child process with custom env vars
 * to verify fail-fast startup behavior when JWT_SECRET is missing or insecure.
 */
function runServerStartupCheck(envOverrides) {
  return new Promise((resolve) => {
    const childEnv = {
      ...process.env,
      PORT: '0',
      ...envOverrides,
    };
    const child = spawn(process.execPath, [SERVER_PATH], {
      cwd: path.resolve(__dirname, '../..'),
      env: childEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });

    const timer = setTimeout(() => {
      child.kill('SIGTERM');
    }, 5000);

    child.on('exit', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

test('Security - Express trust proxy is configured for Render reverse proxy', () => {
  assert.strictEqual(app.get('trust proxy'), 1);
});

test('Security - getJwtSecret rejects empty, placeholder, and short production secrets', () => {
  const origSecret = process.env.JWT_SECRET;
  const origNodeEnv = process.env.NODE_ENV;

  try {
    process.env.NODE_ENV = 'production';

    process.env.JWT_SECRET = '';
    assert.throws(() => getJwtSecret(), /JWT_SECRET environment variable is required/);

    process.env.JWT_SECRET = 'fallback_secret_never_use_in_prod';
    assert.throws(() => getJwtSecret(), /insecure placeholder/);

    process.env.JWT_SECRET = 'short-secret-123';
    assert.throws(() => getJwtSecret(), /at least 32 characters/);

    process.env.JWT_SECRET = 'a'.repeat(64);
    assert.strictEqual(getJwtSecret().length, 64);
  } finally {
    process.env.JWT_SECRET = origSecret;
    process.env.NODE_ENV = origNodeEnv;
  }
});

test('Security - Server fails fast at startup when production JWT_SECRET is missing or insecure', async () => {
  const emptyResult = await runServerStartupCheck({
    NODE_ENV: 'production',
    JWT_SECRET: '',
  });
  assert.strictEqual(emptyResult.code, 1, 'Server must exit with code 1 for empty/missing JWT_SECRET');
  assert.match(emptyResult.stdout + emptyResult.stderr, /SECURITY STARTUP ABORT/);

  const placeholderResult = await runServerStartupCheck({
    NODE_ENV: 'production',
    JWT_SECRET: 'fallback_secret_never_use_in_prod',
  });
  assert.strictEqual(placeholderResult.code, 1, 'Server must exit with code 1 for placeholder JWT_SECRET');
  assert.match(placeholderResult.stdout + placeholderResult.stderr, /SECURITY STARTUP ABORT/);

  const shortResult = await runServerStartupCheck({
    NODE_ENV: 'production',
    JWT_SECRET: 'too_short_secret',
  });
  assert.strictEqual(shortResult.code, 1, 'Server must exit with code 1 for short production JWT_SECRET');
  assert.match(shortResult.stdout + shortResult.stderr, /at least 32 characters/);
});

test('Security - Firebase login rejects missing, malformed, and forged tokens without issuing JWT', async () => {
  await withTestServer(async (baseUrl) => {
    // Case 1: Missing idToken with staff email (previous bypass vector)
    const res1 = await fetch(`${baseUrl}/api/v1/auth/firebase-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@example.com' }),
    });
    const body1 = await res1.json();
    assert.strictEqual(res1.status, 401);
    assert.strictEqual(body1.data?.token, undefined);

    // Case 2: Malformed fake idToken
    const res2 = await fetch(`${baseUrl}/api/v1/auth/firebase-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: 'not-a-valid-token', email: 'admin@example.com' }),
    });
    const body2 = await res2.json();
    assert.strictEqual(res2.status, 401);
    assert.strictEqual(body2.data?.token, undefined);

    // Case 3: Structurally JWT-like forged idToken (must fail closed with 503 disabled or 401 invalid)
    const forgedJwt = 'eyJhbGciOiJSUzI1NiJ9.eyJlbWFpbCI6ImFkbWluQGV4YW1wbGUuY29tIn0.fake_sig';
    const res3 = await fetch(`${baseUrl}/api/v1/auth/firebase-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: forgedJwt, email: 'admin@example.com' }),
    });
    const body3 = await res3.json();
    assert.ok([401, 503].includes(res3.status), `Expected 401 or 503, got ${res3.status}`);
    assert.strictEqual(body3.data?.token, undefined);
  });
});

test('Security - Private prescription files cannot be accessed publicly or by unauthorized roles', async () => {
  await withTestServer(async (baseUrl) => {
    // 1. Direct static access to /uploads/prescriptions/* must be forbidden (403)
    const directRes = await fetch(`${baseUrl}/uploads/prescriptions/rx_test_private.jpg`);
    assert.strictEqual(directRes.status, 403);

    // 2. Authenticated prescription file endpoint without token -> 401
    const unauthFileRes = await fetch(`${baseUrl}/api/v1/prescriptions/files/rx_test_private.jpg`);
    assert.strictEqual(unauthFileRes.status, 401);

    // 3. Authenticated inquiry image endpoint without token -> 401
    const unauthInquiryImg = await fetch(`${baseUrl}/api/v1/inquiries/1/image`);
    assert.strictEqual(unauthInquiryImg.status, 401);

    // 4. Forged JWT signed with old fallback secret must be rejected (401)
    const forgedFallbackToken = jwt.sign(
      { id: 1, username: 'admin', role: 'admin' },
      'fallback_secret_never_use_in_prod',
      { expiresIn: '1h' }
    );
    const forgedRes = await fetch(`${baseUrl}/api/v1/prescriptions`, {
      headers: { Authorization: `Bearer ${forgedFallbackToken}` },
    });
    assert.strictEqual(forgedRes.status, 401);

    // 5. Protected staff inquiry list without auth -> 401
    const unauthInquiries = await fetch(`${baseUrl}/api/v1/inquiries`);
    assert.strictEqual(unauthInquiries.status, 401);
  });
});

test('Security & Workflow - Public inquiry validation and proxy header handling work safely', async () => {
  await withTestServer(async (baseUrl) => {
    // Simulate Render reverse proxy X-Forwarded-For header on public inquiry validation
    const res = await fetch(`${baseUrl}/api/v1/inquiries`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '203.0.113.42',
      },
      body: JSON.stringify({ doctorName: '', clinicHospitalName: '', email: 'invalid' }),
    });
    // Validation must reject bad input cleanly with 400 (not 500 proxy error)
    assert.strictEqual(res.status, 400);
  });
});

test('Frontend Media & Inquiry URL Resolution - Resolves Render backend origin cleanly', () => {
  // Mirror client.js resolveMediaUrl & inquiries.js getInquiryImageUrl contract
  const getBackendOrigin = (apiBaseUrl) => {
    if (!apiBaseUrl || !/^https?:\/\//i.test(apiBaseUrl)) return '';
    return new URL(apiBaseUrl).origin;
  };
  const resolveMediaUrl = (url, apiBaseUrl) => {
    if (!url) return '';
    if (/^(https?:\/\/|data:|blob:)/i.test(url.trim())) return url.trim();
    const origin = getBackendOrigin(apiBaseUrl);
    const pathPart = url.startsWith('/') ? url : `/${url}`;
    return origin ? `${origin}${pathPart}` : pathPart;
  };
  const buildInquiryImageUrl = (id, apiBaseUrl, token) => {
    const base = apiBaseUrl.replace(/\/+$/, '');
    const pathUrl = `${base}/inquiries/${encodeURIComponent(id)}/image`;
    return token ? `${pathUrl}?token=${encodeURIComponent(token)}` : pathUrl;
  };

  const renderApi = 'https://pharmacare-api.onrender.com/api/v1';

  // Doctor photo relative path -> absolute Render URL
  assert.strictEqual(
    resolveMediaUrl('/uploads/doctors/doc_123.jpg', renderApi),
    'https://pharmacare-api.onrender.com/uploads/doctors/doc_123.jpg'
  );
  // External object storage URL (Cloudinary/R2) -> preserved unchanged
  assert.strictEqual(
    resolveMediaUrl('https://res.cloudinary.com/demo/image/upload/doc.jpg', renderApi),
    'https://res.cloudinary.com/demo/image/upload/doc.jpg'
  );
  // Local dev relative proxy -> kept relative
  assert.strictEqual(
    resolveMediaUrl('/uploads/doctors/doc_123.jpg', '/api/v1'),
    '/uploads/doctors/doc_123.jpg'
  );
  // Inquiry image URL -> uses VITE_API_BASE_URL + pharma_token
  assert.strictEqual(
    buildInquiryImageUrl(42, renderApi, 'sample.jwt.token'),
    'https://pharmacare-api.onrender.com/api/v1/inquiries/42/image?token=sample.jwt.token'
  );
});

test('Health & Database - API /api/v1/health and existing TiDB Cloud SSL connection are healthy', async () => {
  const dbHealth = await checkDbHealth();
  assert.strictEqual(dbHealth.ok, true, `TiDB Cloud health check failed: ${dbHealth.error || 'unknown'}`);
  assert.strictEqual(dbHealth.connected, true);

  await withTestServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/v1/health`, {
      headers: { 'X-Forwarded-For': '198.51.100.10' },
    });
    const body = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(body.status, 'healthy');
    assert.strictEqual(body.database.connected, true);
  });
});
