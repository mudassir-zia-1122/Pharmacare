# PharmaCare — Security & Deployment Remediation Report

**Project Root:** `C:\Users\DELL\Desktop\Pharmacy`  
**Target Repository:** `https://github.com/mudassir-zia-1122/Pharmacare`  
**Target Deployment Stack:** Vercel Hobby (Frontend) + Render Free (Backend) + TiDB Cloud Serverless (Database)  
**Remediation Date:** 2026-11-18  
**Pre-Edit Backup Location:** `C:\Users\DELL\.gemini\antigravity\brain\20ef6cbd-e666-45b4-a0ef-1f2a714993d3\scratch\remediation_backup_20261118`  
**Git / Deploy Status:** **NOT COMMITTED, NOT PUSHED, NOT DEPLOYED (Awaiting User Approval)**

---

## 1. Executive Status Matrix

| Phase / Item | Issue | Status | Notes |
| :--- | :--- | :---: | :--- |
| **Phase 1.1** | Firebase Authentication Bypass (`POST /api/v1/auth/firebase-login`) | **PASS** *(Disabled / Fail-Closed)* | Never trusts client email/role; rejects missing/malformed tokens (`401`) and fails closed (`503`) unless `FIREBASE_AUTH_ENABLED=true` + Firebase Admin SDK + server credentials are configured. |
| **Phase 1.2** | Login Page Pre-Filled & Preset Credentials | **PASS** | All pre-filled usernames/passwords and Quick Fill preset buttons removed from `LoginPage.jsx`; standard staff login preserved. |
| **Phase 1.3** | JWT Secret Management & Startup Validation | **PASS** | Silent fallback `JWT_SECRET` completely removed; server fails fast (`exit 1`) on startup if `JWT_SECRET` is empty, placeholder, or `< 32` chars in production. |
| **Phase 1.4** | Express Proxy & Rate-Limiter Client IP (`trust proxy`) | **PASS** | `app.set('trust proxy', 1)` enabled; CORS origin parsing hardened with `.trim()` and trailing-slash normalization; verified with `X-Forwarded-For` header. |
| **Phase 1.5** | Private Prescription Upload Protection | **PASS** | Public static serving of `/uploads` replaced with `/uploads/doctors` only; direct `/uploads/prescriptions/*` blocked (`403`); authenticated streaming added/fixed for Admin, Pharmacist, and Doctor roles with strict path-traversal containment. |
| **Phase 2.1** | Inquiry Image Helper (`inquiries.js`) | **PASS** | `getInquiryImageUrl()` now consistently uses `VITE_API_BASE_URL` (via `API_BASE_URL`) and `localStorage.getItem('pharma_token')`. |
| **Phase 2.2** | Doctor Photos Cross-Origin Resolution | **PASS** | Added `resolveMediaUrl()` in `client.js` (re-exported via `api/index.js`) and wired into `DoctorsPage.jsx` and `BookAppointmentPage.jsx` + added `/uploads` proxy in `vite.config.js`. |
| **Phase 2.3** | Render Free Cold-Start Timeout Handling | **PASS** | Axios timeout raised from `15000` ms to `60000` ms with clear cold-start/timeout error messages and zero infinite retry loops. |
| **Phase 3** | Persistent Object Storage for Uploads (Render Free) | **MANUAL CONFIGURATION** | Upload categories inventoried; zero cloud-storage credentials currently configured; existing upload folders untouched. Persistent uploads remain a **deployment blocker for upload features** on Render Free until external object storage is configured. |
| **Phase 4** | `.gitignore` Security Exclusions | **PASS** | `backend/scripts/run-e2e-repair-verification.js` added to `.gitignore` and preserved locally; verified all `.env`, certs, backups, uploads, logs, and `node_modules` remain excluded. |
| **Phase 5** | Full Automated Testing & Production Build | **PASS** | **37/37** backend unit & security tests passed (0 failures); frontend production Vite build succeeded cleanly (`2,329` modules). |

---

## 2. Detailed Summary of Code & Configuration Changes

### Modified Files (15)
1. `.gitignore` — Added `backend/scripts/run-e2e-repair-verification.js`.
2. `backend/src/server.js` — Added fail-fast `validateSecurityConfigOnStartup()` before `server.listen(PORT, '0.0.0.0', ...)`.
3. `backend/src/app.js` — Added `app.set('trust proxy', 1)`; replaced public `/uploads` mount with explicit `403` block on `/uploads/prescriptions` and static serving of `/uploads/doctors` only; trimmed/normalized `CORS_ORIGIN` entries.
4. `backend/src/middleware/authMiddleware.js` — Replaced fallback `JWT_SECRET` with strict `getJwtSecret()`.
5. `backend/src/services/auth.service.js` — Replaced fallback `JWT_SECRET` with `getJwtSecret()`; hardened `loginWithFirebase()` to reject invalid/missing tokens (`401`), ignore client-supplied email/role, fail closed (`503`) unless Firebase Admin SDK & credentials are configured, and fetch real DB role/status exclusively from the verified token email.
6. `backend/src/controllers/inquiry.controller.js` — Fixed CWD-independent `PRESCRIPTION_UPLOAD_DIR` resolution via `import.meta.url`, added `path.basename` + strict containment check, and set `Cache-Control: private, no-store`.
7. `backend/src/controllers/prescription.controller.js` — Added authenticated `streamPrescriptionFile` handler with strict filename validation and containment checks.
8. `backend/src/routes/prescription.routes.js` — Mounted `GET /api/v1/prescriptions/files/:filename` protected by `authenticate` + `hasRole(ADMIN, PHARMACIST, DOCTOR)`.
9. `frontend/src/pages/auth/LoginPage.jsx` — Removed pre-filled credentials and Quick Fill preset buttons; hid Firebase tab unless `VITE_ENABLE_FIREBASE_AUTH=true`; added clear initial server-connection status message.
10. `frontend/src/api/client.js` — Exported `API_BASE_URL`, `BACKEND_ORIGIN`, `getBackendOrigin()`, and `resolveMediaUrl()`; raised Axios timeout to `60000` ms with cold-start messaging and no infinite retries.
11. `frontend/src/api/index.js` — Re-exported `API_BASE_URL`, `BACKEND_ORIGIN`, `getBackendOrigin`, and `resolveMediaUrl`.
12. `frontend/src/api/inquiries.js` — Fixed `getInquiryImageUrl()` to use `API_BASE_URL` (`VITE_API_BASE_URL`) and `localStorage.getItem('pharma_token')`.
13. `frontend/src/pages/doctors/DoctorsPage.jsx` — Wrapped doctor photo `src` and preview with `resolveMediaUrl()`.
14. `frontend/src/pages/appointments/BookAppointmentPage.jsx` — Wrapped doctor photo `src` with `resolveMediaUrl()`.
15. `frontend/vite.config.js` — Added `/uploads` proxy to `http://localhost:5000` for local development parity.

### New Files Added (2)
1. `backend/src/config/security.js` — Centralized `JWT_SECRET` validation (`getJwtSecret`, `validateSecurityConfigOnStartup`).
2. `backend/src/tests/security_remediation.test.js` — Automated HTTP & startup security test suite (8 tests).

---

## 3. Phase 3 — Persistent File Storage Architecture (MANUAL CONFIGURATION)

### Upload Categories Identified
| Category | Current Local Path | Privacy Level | Existing Local Files | Render Free Survival |
| :--- | :--- | :---: | :---: | :---: |
| **Doctor Profile Photos** | `backend/uploads/doctors/` | Public (directory & booking UI) | 0 | **No (Ephemeral)** |
| **Prescription & Inquiry Attachments** | `backend/uploads/prescriptions/` | **Private PHI** (Admin/Pharmacist/Doctor only) | 0 | **No (Ephemeral)** |

### Recommended Persistent Object-Storage Solution
Because Render Free wipes local disk on every spin-down (15 min idle), restart, and redeployment, **do not rely on local disk in production**:

1. **Option 1 (Fastest Free Tier): Cloudinary + Signed Private Delivery**
   - Public folder `pharmacare/doctors` for doctor profile photos -> store HTTPS URL in `doctors.profile_photo_url` (already supported transparently by `resolveMediaUrl()`).
   - Authenticated/private delivery type (`type: 'authenticated'`) in `pharmacare/prescriptions` -> store `public_id` in DB and generate short-lived signed URLs (e.g., 60s TTL) inside `GET /api/v1/inquiries/:id/image` and `GET /api/v1/prescriptions/files/:filename` after `authenticate` + `hasRole(...)`.
   - Required Render env vars (manual setup): `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
2. **Option 2 (Best S3-Compatible Free Tier): Cloudflare R2 (10 GB Free, Zero Egress)**
   - Public bucket (custom domain / R2 public URL) for doctor photos.
   - **Private bucket** (no public access) for prescriptions; stream via backend `@aws-sdk/client-s3` `GetObjectCommand` or 60-second presigned URLs after RBAC checks.
   - Required Render env vars (manual setup): `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_BUCKET`, `R2_PRIVATE_BUCKET`, `R2_PUBLIC_BASE_URL`.

> **Existing Files:** No existing local uploaded files were modified, migrated, or deleted.

---

## 4. Phase 5 — Verification & Test Results

| Test Category | Command / Scope | Result | Details |
| :--- | :--- | :---: | :--- |
| **Frontend Production Build** | `cd frontend && npm run build` | **PASS** | `vite build` transformed 2,329 modules cleanly in `16.02s` (`dist/index.html`, CSS, JS generated; exit code 0). |
| **Backend Complete Automated Suite** | `cd backend && npm test` | **PASS** | **37/37 passed**, **0 failed**, duration `14.37s` (all 29 existing POS/FEFO/Math/Email/RBAC/Safety tests + 8 new security tests). |
| **Auth & RBAC Tests** | `rbac.test.js` + `security_remediation.test.js` | **PASS** | Allowed roles permitted, disallowed roles receive `403`, unauthenticated & forged fallback JWTs receive `401`. |
| **Invalid Firebase Token Test** | `POST /api/v1/auth/firebase-login` | **PASS** | Missing token -> `401`; malformed token -> `401`; forged JWT-like token -> `503` (disabled fail-closed); **0 JWTs issued**. |
| **Missing / Insecure `JWT_SECRET` Startup Test** | Child process `node src/server.js` (`NODE_ENV=production`) | **PASS** | Empty `JWT_SECRET`, placeholder fallback string, and `<32`-char secret all exited immediately with code `1` and `[SECURITY STARTUP ABORT]`. |
| **Express `trust proxy` & Rate Limiter Test** | `app.get('trust proxy')` + `X-Forwarded-For` request | **PASS** | `trust proxy === 1`; requests with `X-Forwarded-For` handled cleanly with no proxy validation errors. |
| **Prescription Unauthorized-Access Test** | Direct `/uploads/prescriptions/*` & API endpoints | **PASS** | Direct `/uploads/prescriptions/...` -> `403`; unauthenticated `/api/v1/prescriptions/files/...` -> `401`; unauthenticated `/api/v1/inquiries/1/image` -> `401`; forged fallback token -> `401`. |
| **Doctor & Inquiry Image URL Resolution Test** | `resolveMediaUrl` & `getInquiryImageUrl` contract | **PASS** | Relative `/uploads/doctors/...` resolves to `https://<render-host>/uploads/doctors/...`; external HTTPS URLs pass through unchanged; inquiry image URL uses `VITE_API_BASE_URL` + `pharma_token`. |
| **Inquiry Workflow Validation Test** | `POST /api/v1/inquiries` + `GET /api/v1/inquiries` | **PASS** | Invalid public submission rejected (`400`); unauthenticated staff listing rejected (`401`); email confirmation & response workflows verified in `email.test.js`. |
| **API Health & Existing TiDB Cloud Test** | `GET /api/v1/health` + `checkDbHealth()` | **PASS** | HTTP `200`, `status: "healthy"`, `database.connected: true` against live TiDB Cloud SSL (read-only `SELECT 1`; zero data altered). |
| **`.gitignore` Exclusion Check** | `git check-ignore -v` | **PASS** | `backend/scripts/run-e2e-repair-verification.js`, `.env`, `certs/`, `*.pem`, `database/backups/`, `uploads/`, `node_modules/`, and `*.log` all confirmed ignored. |

---

## 5. Remaining Deployment Blockers / Manual Actions Required

1. **[MANUAL CONFIGURATION — Blocker for File Upload Features on Render Free]:** Persistent cloud object storage (Cloudinary or Cloudflare R2) credentials are not yet configured. Core pharmacy, POS, inventory, appointments, queue, finance, and reports modules are ready to deploy, **but** persistent doctor photo uploads and prescription file uploads remain blocked on Render Free until object storage is connected.
2. **[MANUAL CONFIGURATION — Production Admin Password Rotation]:** Rotate the live Admin password in TiDB (via the app's Change Password feature) before opening the deployed URL to the public, since historical QA scripts in commit `4d66e06` reference default demo credentials.
3. **[MANUAL CONFIGURATION — Optional Firebase Auth]:** Firebase login is safely disabled (`503`) by default. If you ever want Firebase login enabled in production, install `firebase-admin`, configure `FIREBASE_AUTH_ENABLED=true` + `FIREBASE_SERVICE_ACCOUNT_JSON` on Render, and set `VITE_ENABLE_FIREBASE_AUTH=true` on Vercel.
4. **[MANUAL CONFIGURATION — Render & Vercel Env Vars + TiDB IP Access List]:** Set all sanitized environment variables listed in `PharmaCare_Deployment_Readiness_Report.md` in the Render and Vercel dashboards before going live.

---

## 6. Next Step — Awaiting Your Approval

No Git commit, GitHub push, or cloud deployment has been executed. Please confirm if you approve committing these verified security fixes to `master` (and whether you would also like to connect Cloudinary or Cloudflare R2 for persistent uploads before deploying).
