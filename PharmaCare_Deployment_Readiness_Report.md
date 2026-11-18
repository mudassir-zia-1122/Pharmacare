# PharmaCare — Deployment Readiness Audit Report

**Audit Scope:** Deployment-Readiness Audit Only (No code modified, no database altered, no deployment or Git push performed)  
**Project Root:** `C:\Users\DELL\Desktop\Pharmacy`  
**Target GitHub Repository:** `https://github.com/mudassir-zia-1122/Pharmacare`  
**Target Stack:**
- **Frontend:** Vercel Hobby (`frontend/`)
- **Backend:** Render Free (`backend/`)
- **Database:** Existing TiDB Cloud Serverless (`pharmacare`)

**Audit Date:** 2026-11-18  
**Overall Verdict:** **`NOT READY FOR PUBLIC PRODUCTION DEPLOYMENT — 4 CRITICAL FAILURES TO FIX BEFORE DEPLOY`**

---

## 1. Executive Summary Matrix

| # | Audit Dimension | Result | Severity | Summary |
| :-: | :--- | :---: | :---: | :--- |
| 1 | Frontend Build & Output Directory (Vercel) | **PASS** | — | `npm run build` (`vite build`) succeeds cleanly (`dist/`); `vercel.json` SPA rewrites configured. |
| 2 | Backend Start Command & Dynamic `PORT` (Render) | **PASS** *(Caveat)* | Medium | `npm start` (`node src/server.js`) reads dynamic `process.env.PORT`; missing `trust proxy` for Render proxy. |
| 3 | API Health Endpoint | **PASS** | — | `GET /api/v1/health` checks live TiDB connectivity (`200 healthy` / `503 degraded`). |
| 4 | CORS Support for Vercel Frontend Domain | **PASS** *(Manual Config)* | Low | Supports `CORS_ORIGIN` env var; lacks `.trim()` / trailing-slash normalization and preview-domain handling. |
| 5 | Frontend API URL via `VITE_API_BASE_URL` | **FAIL** | **High** | Core Axios client uses `VITE_API_BASE_URL`, **but** inquiry image streaming & doctor photos use relative paths that break cross-origin on Vercel → Render; inquiry helper reads wrong token key. |
| 6 | TiDB Cloud SSL in Production | **PASS** *(Manual Config)* | — | Live verified TLS 1.2+ (`rejectUnauthorized: true`) using Node's built-in root CA store without needing local `.pem`. |
| 7 | Environment Variables Audit | **MANUAL CONFIG** | — | 29 backend env vars and 8 frontend `VITE_*` vars cataloged using sanitized placeholders only. |
| 8 | File Uploads Durability on Render Free | **FAIL** | **High** | Uses `multer.diskStorage` (`backend/uploads/`); Render Free filesystem is ephemeral — all doctor photos & prescriptions will be **wiped** on restart/spin-down/redeploy. |
| 9 | Auth, JWT Security, RBAC & Public Endpoints | **FAIL** | **CRITICAL (P0)** | (1) `POST /api/v1/auth/firebase-login` issues admin JWTs **without verifying `idToken`**; (2) `LoginPage.jsx` pre-fills admin credentials in UI source; (3) Hardcoded fallback `JWT_SECRET` if env var missing; (4) Missing `app.set('trust proxy', 1)` for `express-rate-limit`. |
| 10 | `.gitignore` Security Exclusions | **FAIL** | **High** | Sensitive files (`.env`, `certs/`, `*.pem`, `uploads/`, `database/backups/`, `node_modules/`, `*.log`) are ignored, **but** `backend/scripts/run-e2e-repair-verification.js` is **NOT** excluded in `.gitignore`. |

---

## 2. Detailed Audit Findings

### 1. Frontend Build Command & Output Directory — **PASS**
- **Location:** `frontend/package.json`, `frontend/vite.config.js`, `frontend/vercel.json`
- **Findings:**
  - Build command: `npm run build` (`vite build`).
  - Output directory: `dist`.
  - Live build test executed during audit: **SUCCEEDED** (2,329 modules transformed in 32.84s; `dist/index.html`, `dist/assets/*.css`, `dist/assets/*.js` generated cleanly with exit code 0).
  - SPA client-side routing rewrite is already configured in `frontend/vercel.json` (`/(.*) -> /index.html`), preventing 404 errors on deep links such as `/book-appointment` or `/dashboard`.
- **Minor Non-Blocking Observation:**
  - Main JS bundle is `1,309.77 kB` (`327.43 kB` gzipped), triggering Vite's 800 kB chunk-size warning. Consider code-splitting later (`manualChunks` / lazy routes).
- **Render Cold-Start Warning (Frontend Timeout):**
  - `frontend/src/api/client.js:8` sets `timeout: 15000` (15 seconds). Render Free services spin down after 15 minutes of inactivity and typically take **30–50 seconds** for a cold start. First requests after idle will time out at 15s unless `timeout` is increased (e.g., `60000` ms).

---

### 2. Backend Start Command & Dynamic `PORT` — **PASS** *(with Proxy Caveat)*
- **Location:** `backend/package.json`, `backend/src/server.js` (lines 25–55)
- **Findings:**
  - Start command: `npm start` (`node src/server.js`).
  - Dynamic port: `const PORT = parseInt(process.env.PORT || '5000', 10);` — properly consumes Render's injected `PORT` environment variable.
  - Graceful shutdown handlers (`SIGTERM`, `SIGINT`) are implemented (`server.js:46-55`).
  - `puppeteer-core` is properly isolated in `devDependencies` (use `npm ci --omit=dev` or `npm install --omit=dev` as Render's build command to speed up deploys and save RAM on Render Free).
- **Recommendations:**
  - Add `"engines": { "node": ">=20.0.0" }` to `backend/package.json` so Render selects a modern Node runtime.
  - Explicitly bind `server.listen(PORT, '0.0.0.0', ...)` (Node binds wildcard by default, but explicit `0.0.0.0` is Render's documented best practice).
  - **Required Proxy Fix:** Add `app.set('trust proxy', 1);` in `backend/src/app.js` (Render routes traffic through a reverse proxy; see Section 9).

---

### 3. API Health Endpoint — **PASS**
- **Location:** `backend/src/routes/index.js` (lines 26–35)
- **Findings:**
  - Endpoint: `GET /api/v1/health` (public, unauthenticated).
  - Runs live `SELECT 1 AS alive` via `checkDbHealth()`.
  - Returns HTTP `200` (`{ status: "healthy", database: { ok: true, connected: true, ssl: true, ... } }`) when TiDB is reachable and HTTP `503` (`status: "degraded"`) if the database is unreachable.
  - **Note:** `GET /api/v1/health` currently returns `database.host` and `database.database` publicly; not a secret, though you may optionally strip `host` in production to minimize infrastructure fingerprinting.
  - Configure Render's **Health Check Path** to `/api/v1/health`.

---

### 4. CORS Configuration for Future Vercel Domain — **PASS** *(Requires Manual Config & Hardening)*
- **Location:** `backend/src/app.js` (lines 43–58)
- **Findings:**
  - Reads `process.env.CORS_ORIGIN` split on `,`, allows `credentials: true`, standard REST methods (`GET, POST, PUT, PATCH, DELETE, OPTIONS`), and headers (`Content-Type`, `Authorization`).
  - Setting `CORS_ORIGIN=https://<your-project>.vercel.app` on Render will allow the Vercel production domain.
- **Caveats to Watch / Harden:**
  - `.split(',')` does **not** trim spaces or strip trailing slashes (`/`). Putting a space after a comma or a trailing `/` in Render's `CORS_ORIGIN` value will break CORS checks.
  - Vercel Preview deployments (`https://<project>-<hash>-<scope>.vercel.app`) will be blocked by CORS unless explicitly added or handled with a controlled regex/origin matcher.

---

### 5. Frontend API URL Configuration (`VITE_API_BASE_URL`) — **FAIL**
- **Locations:** `frontend/src/api/client.js:4`, `frontend/src/api/inquiries.js:52-55`, `frontend/src/pages/doctors/DoctorsPage.jsx`, `frontend/src/pages/appointments/BookAppointmentPage.jsx:404-407`, `backend/src/controllers/doctor.controller.js:59`
- **What Passed:**
  - `apiClient` in `frontend/src/api/client.js` cleanly uses `import.meta.env.VITE_API_BASE_URL || '/api/v1'`. Setting `VITE_API_BASE_URL=https://<your-render-service>.onrender.com/api/v1` in Vercel will route all Axios API calls to Render.
- **Failures Identified (Will Break on Vercel → Render):**
  1. **Inquiry Prescription Image URL Bug (`frontend/src/api/inquiries.js:52-55`):**
     - Hardcodes relative path `/api/v1/inquiries/${id}/image` instead of prefixing `import.meta.env.VITE_API_BASE_URL`. On Vercel, requests to `/api/v1/...` hit Vercel's SPA rewrite (`index.html`) instead of Render.
     - Reads token from `auth_token` / `token` instead of `pharma_token` (the actual key used by `AuthContext.jsx` and `client.js`), resulting in `401 Unauthorized` on image loads.
  2. **Doctor Photo Relative Path Bug (`doctor.controller.js:59`, `DoctorsPage.jsx`, `BookAppointmentPage.jsx`):**
     - Backend stores relative path `/uploads/doctors/<file>` in `doctors.profile_photo_url`.
     - Frontend renders `<img src={doc.photoUrl} />` directly. On Vercel, `<img src="/uploads/doctors/...">` resolves against the Vercel domain (`https://your-app.vercel.app/uploads/...`), returning `index.html` instead of the image hosted on Render (or external object storage).

---

### 6. TiDB Cloud SSL Connection in Production — **PASS** *(Verified Live)*
- **Location:** `backend/src/config/db.js` (lines 27–60)
- **Findings:**
  - `buildSslConfig()` enforces `minVersion: 'TLSv1.2'` and `rejectUnauthorized: true` whenever `DB_SSL=true`.
  - Because `certs/` and `*.pem` are excluded from Git (correctly), `backend/certs/isrgrootx1.pem` will not exist in the Render container built from GitHub.
  - **Live Read-Only Verification:** Tested connecting from Node.js directly to the existing TiDB Cloud cluster with `{ minVersion: 'TLSv1.2', rejectUnauthorized: true }` and **no local PEM file**. Result: **`alive: 1`, strict TLS verification succeeded via Node's built-in root CA trust store** (ISRG Root X1 is trusted natively).
  - **Manual Production Configuration:** On Render, set `DB_SSL=true` and **leave `DB_CA_PATH` unset** (or mount `isrgrootx1.pem` as a Render Secret File at `/etc/secrets/isrgrootx1.pem` and point `DB_CA_PATH` there if you want an explicit CA pin).

---

### 7. Environment Variables Inventory (Sanitized Names Only) — **MANUAL CONFIGURATION REQUIRED**

> Zero secret values were read or included in this report. Configure these manually in the **Render Dashboard** and **Vercel Dashboard**.

#### Backend Environment Variables (Render Free — Root Directory: `backend`)

| Variable Name | Required | Sanitized Example / Guidance |
| :--- | :---: | :--- |
| `NODE_ENV` | **Yes** | `production` |
| `PORT` | Auto (Render) | Injected automatically by Render (do not hardcode `5000`) |
| `API_PREFIX` | Optional | `/api/v1` |
| `DB_HOST` | **Yes** | `<tidb-gateway-host>.tidbcloud.com` |
| `DB_PORT` | **Yes** | `4000` |
| `DB_USER` | **Yes** | `<tidb_user_prefix>.root` |
| `DB_PASSWORD` | **Yes** | `<your_tidb_password>` |
| `DB_NAME` | **Yes** | `pharmacare` |
| `DB_SSL` | **Yes** | `true` |
| `DB_CA_PATH` | Optional | Leave unset on Render (uses Node system ISRG Root X1), or `/etc/secrets/isrgrootx1.pem` |
| `DB_CONNECTION_LIMIT` | Optional | `10` (keep low on Render Free / TiDB Serverless) |
| `DB_QUEUE_LIMIT` | Optional | `0` |
| `DB_WAIT_FOR_CONNECTIONS` | Optional | `true` |
| `JWT_SECRET` | **Yes (CRITICAL)** | `<64+ char cryptographically random hex string>` |
| `JWT_EXPIRES_IN` | Optional | `8h` |
| `BCRYPT_SALT_ROUNDS` | Optional | `12` |
| `CORS_ORIGIN` | **Yes** | `https://<your-vercel-app>.vercel.app` (no spaces, no trailing `/`) |
| `RATE_LIMIT_WINDOW_MS` | Optional | `900000` |
| `RATE_LIMIT_MAX_REQUESTS` | Optional | `500` |
| `AUTH_RATE_LIMIT_MAX` | Optional | `15` |
| `INQUIRY_RATE_LIMIT_MAX` | Optional | `20` |
| `SMTP_HOST` | Optional (Email) | `smtp.gmail.com` |
| `SMTP_PORT` | Optional (Email) | `587` |
| `SMTP_SECURE` | Optional (Email) | `false` |
| `SMTP_USER` | Optional (Email) | `<your-smtp-email>` |
| `SMTP_PASS` | Optional (Email) | `<your-16-char-app-password>` |
| `EMAIL_FROM` / `SMTP_FROM` | Optional (Email) | `"PharmaCare Clinical Pharmacy" <noreply@yourdomain.com>` |
| `PHARMACY_NOTIFICATION_EMAIL` | Optional (Email) | `<pharmacy-alerts-email>` |

#### Frontend Environment Variables (Vercel Hobby — Root Directory: `frontend`)

| Variable Name | Required | Sanitized Example / Guidance |
| :--- | :---: | :--- |
| `VITE_API_BASE_URL` | **Yes** | `https://<your-render-service>.onrender.com/api/v1` |
| `VITE_FIREBASE_API_KEY` | Optional (if Firebase used) | `<firebase-web-api-key>` |
| `VITE_FIREBASE_AUTH_DOMAIN` | Optional | `<project-id>.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | Optional | `<project-id>` |
| `VITE_FIREBASE_STORAGE_BUCKET` | Optional | `<project-id>.firebasestorage.app` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Optional | `<sender-id>` |
| `VITE_FIREBASE_APP_ID` | Optional | `<web-app-id>` |
| `VITE_FIREBASE_MEASUREMENT_ID` | Optional | `<measurement-id>` |

> **Note:** `frontend/src/config/firebase.js` currently embeds fallback Firebase web config literals. While Firebase web config values are public client identifiers (not secret keys), removing fallbacks and restricting your Firebase API key by HTTP referrer (`https://<your-app>.vercel.app/*`) in Google Cloud Console is best practice.

---

### 8. File Uploads Survival on Render Free — **FAIL**
- **Location:** `backend/src/config/upload.js`, `backend/src/app.js` (lines 31–34)
- **Findings:**
  - `prescriptionUpload` saves files to local disk: `backend/uploads/prescriptions/`
  - `doctorPhotoUpload` saves files to local disk: `backend/uploads/doctors/`
  - **Will uploaded files survive Render restarts and redeployments?** **NO.**
  - Render Free Web Services run on an **ephemeral container filesystem**. Every time Render redeploys, restarts, or spins down due to 15 minutes of inactivity, all files written to `backend/uploads/` are **permanently erased**, leaving broken image links and missing prescription documents referenced in TiDB.
  - Render Persistent Disks require a paid plan (not available on Render Free).
- **Required Production Solution:**
  - Migrate Multer storage to `multer.memoryStorage()` and upload files to a free-tier persistent object store such as **Cloudinary** (free tier), **Cloudflare R2** (10 GB free), **Supabase Storage**, or **AWS S3**, storing the resulting HTTPS URLs (or private object keys for signed prescription URLs) in TiDB.
  - Also note: `app.use('/uploads', express.static(uploadsDir))` exposes `backend/uploads/prescriptions` publicly without authentication if someone guesses or obtains a filename — prescriptions contain private patient data (PHI) and should NEVER be served statically from a public `/uploads` folder!

---

### 9. Authentication, JWT Security, RBAC & Public API Endpoints — **FAIL (CRITICAL P0 BLOCKERS)**

#### What Passed:
- **Password Hashing:** `bcryptjs` with 12 salt rounds (`auth.service.js`).
- **RBAC Enforcement:** All sensitive staff routes (`users`, `finance`, `reports`, `prescriptions`, `purchases`, `returns`, `inventory`, `pos`, `patients`, `customers`, `suppliers`, `medicines`, `dashboard`, `notifications`, staff `appointments`, staff `inquiries`, doctor mutations) enforce `authenticate` + `hasRole(...)`.
- **Intentionally Public Endpoints (Verified Appropriate):**
  - `GET /`, `GET /api/v1/health` (service health)
  - `GET /api/v1/settings` (pharmacy name, currency, tax bootstrap — no credentials stored)
  - `POST /api/v1/auth/login` (rate-limited by `authLimiter`)
  - `GET /api/v1/doctors`, `GET /api/v1/doctors/departments`, `GET /api/v1/doctors/:id`, `GET /api/v1/doctors/:id/schedule` (public booking directory)
  - `GET /api/v1/appointments/available-slots`, `POST /api/v1/appointments/book`, `POST /api/v1/appointments`, `POST /api/v1/appointments/lookup`, `GET /api/v1/appointments/queue/display` (public patient booking & waiting-room TV)
  - `POST /api/v1/inquiries` (rate-limited by `inquiryLimiter`)

#### Critical Failures (MUST FIX Before Going Live):
1. **P0 — Unverified Firebase Login Authentication Bypass (`backend/src/services/auth.service.js:127-165`):**
   - `POST /api/v1/auth/firebase-login` accepts `{ idToken, email }` and **never cryptographically verifies `idToken`** via `firebase-admin` or Google's JWKS public keys.
   - Any external attacker knowing (or guessing) a staff/admin email address can obtain a valid **Administrator JWT** without a password or Firebase account.
   - **Remediation:** Verify `idToken` server-side with `firebase-admin` (`admin.auth().verifyIdToken(idToken)`) and derive `email` exclusively from the verified token payload — OR disable `/api/v1/auth/firebase-login` entirely until `firebase-admin` verification is implemented.
2. **P0 — Hardcoded Admin Credentials Pre-Filled in Login UI (`frontend/src/pages/auth/LoginPage.jsx:18`):**
   - `useState({ identifier: 'admin', password: '...' })` pre-populates the live admin username and default password directly in the production browser bundle.
   - **Remediation:** Change initial state to `{ identifier: '', password: '' }` AND rotate the production Admin password in TiDB before going live.
3. **High — Silent Fallback `JWT_SECRET` (`backend/src/middleware/authMiddleware.js:25`, `backend/src/services/auth.service.js:40,156`):**
   - Falls back to `'fallback_secret_never_use_in_prod'` if `JWT_SECRET` is missing. In production, the server should **refuse to start** if `JWT_SECRET` is unset or shorter than 32 characters.
4. **High — Missing `trust proxy` Behind Render Reverse Proxy (`backend/src/app.js`, `backend/src/middleware/rateLimiter.js`):**
   - `express-rate-limit` v7.5.0 requires `app.set('trust proxy', 1)` when running behind Render's proxy. Without it, `X-Forwarded-For` triggers `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` errors or applies rate limits globally to Render's proxy IP across all users.
5. **Medium — Unauthenticated Static Serving of `/uploads/prescriptions` (`backend/src/app.js:34`):**
   - `app.use('/uploads', express.static(uploadsDir))` exposes the entire `uploads/` directory (both `doctors/` and `prescriptions/`) publicly. Only `uploads/doctors` should ever be public; prescriptions must only be served through authenticated endpoints.
6. **Medium — Rate Limiting Missing on Public Appointment Booking (`POST /api/v1/appointments/book`, `/lookup`):**
   - Public booking and lookup endpoints rely only on `globalLimiter` (500 req/15 min). Adding a stricter dedicated limiter (e.g., 20–30 req/15 min per IP) prevents slot-exhaustion spam and reference enumeration.

---

### 10. `.gitignore` Verification — **FAIL**
- **Locations:** `.gitignore`, `backend/.gitignore`, `frontend/.gitignore`
- **What Passed:**
  - Verified with `git check-ignore -v`:
    - `backend/.env` & `frontend/.env` -> **IGNORED**
    - `backend/certs/isrgrootx1.pem` & `*.pem`, `*.key`, `*.crt` -> **IGNORED**
    - `database/backups/` & `*.sql.gz`, `*.dump`, `*.bak` -> **IGNORED**
    - `backend/uploads/` & `uploads/` -> **IGNORED**
    - `backend/node_modules/` & `frontend/node_modules/` -> **IGNORED**
    - `*.log`, `dist/`, `build/` -> **IGNORED**
  - Only `backend/.env.example` and `frontend/.env.example` (sanitized templates) are tracked.
- **Failure Identified:**
  - **`backend/scripts/run-e2e-repair-verification.js` is NOT excluded by `.gitignore`.**
  - Currently it is untracked (`?? backend/scripts/run-e2e-repair-verification.js`), meaning any future `git add .` or `git add -A` would accidentally commit its hardcoded test password and local Windows path (`C:\Users\DELL\.gemini\...`).
  - **Remediation:** Add `backend/scripts/run-e2e-repair-verification.js` to `.gitignore` (or refactor it to read credentials/paths strictly from environment variables).
  - **Secondary Note:** Existing tracked scripts in `backend/scripts/browser-verify.js` and `backend/scripts/inspect-all-pages.js` (from commit `4d66e06`) also contain default demo credentials — ensure the production TiDB Admin password is changed from any seeded default password before exposing the app publicly.

---

## 3. Items Requiring Manual Configuration (When Ready to Deploy)

### A. GitHub Prerequisite
1. Complete the pending interactive `git push -u origin master` from your local PowerShell so commit `9016258` (and subsequent pre-deploy security fixes) are uploaded to `https://github.com/mudassir-zia-1122/Pharmacare`.

### B. Render Free (Backend Web Service)
1. **Repository:** Connect `https://github.com/mudassir-zia-1122/Pharmacare`, Branch: `master`.
2. **Root Directory:** `backend`
3. **Runtime:** `Node`
4. **Build Command:** `npm ci --omit=dev` (or `npm install --omit=dev`)
5. **Start Command:** `npm start`
6. **Health Check Path:** `/api/v1/health`
7. **Environment Variables:** Configure all required backend variables from Section 7 (`NODE_ENV=production`, TiDB credentials + `DB_SSL=true`, strong 64-char `JWT_SECRET`, `CORS_ORIGIN=https://<your-vercel-domain>`, optional SMTP settings).
8. **Note on Free Tier:** Expect ~30–50s cold-start latency after 15 minutes of inactivity.

### C. Vercel Hobby (Frontend Static Site)
1. **Repository:** Connect `https://github.com/mudassir-zia-1122/Pharmacare`, Branch: `master`.
2. **Framework Preset:** `Vite`
3. **Root Directory:** `frontend`
4. **Build Command:** `npm run build`
5. **Output Directory:** `dist`
6. **Environment Variables:** Set `VITE_API_BASE_URL=https://<your-render-service>.onrender.com/api/v1` (plus `VITE_FIREBASE_*` if Firebase auth is retained after server-side token verification is fixed).
7. **After Vercel Assigns Your Live URL:** Update `CORS_ORIGIN` in Render to match the exact Vercel URL (e.g., `https://pharmacare-xyz.vercel.app`) and redeploy Render.

### D. TiDB Cloud (Existing Database)
1. **Do NOT reset or recreate the database.**
2. Verify **IP Access List** in TiDB Cloud Console allows Render's outbound IPs (on Render Free, outbound IPs are dynamic, so TiDB Cloud typically requires `0.0.0.0/0` combined with strong DB password + mandatory TLS `DB_SSL=true`).
3. **Rotate Admin Password** in `users` (via the app's Change Password feature) so no seeded default password remains active in production.

---

## 4. Recommended Pre-Deployment Fix Checklist (In Priority Order)

Before deploying publicly, approve fixes for these items:
1. **[P0 — Security]** Fix or disable `POST /api/v1/auth/firebase-login` so unverified tokens cannot issue JWTs.
2. **[P0 — Security]** Remove pre-filled admin credentials from `frontend/src/pages/auth/LoginPage.jsx`.
3. **[P1 — Security]** Fail fast on startup in production if `JWT_SECRET` is missing; add `app.set('trust proxy', 1)` in `backend/src/app.js`; restrict static `/uploads` to `/uploads/doctors` only.
4. **[P1 — Git Hygiene]** Add `backend/scripts/run-e2e-repair-verification.js` to `.gitignore`.
5. **[P1 — Cross-Origin Bugs]** Fix `getInquiryImageUrl()` in `frontend/src/api/inquiries.js` (`VITE_API_BASE_URL` + `pharma_token`), prefix doctor photo URLs with backend origin (or cloud storage URL), harden `CORS_ORIGIN` `.trim()`/slash stripping, and increase Axios timeout to `60000` ms for Render Free cold starts.
6. **[P1 — Persistence]** Migrate doctor photos and prescription uploads from Render local disk to persistent cloud object storage (e.g., Cloudinary or Cloudflare R2) before relying on uploads in production.
