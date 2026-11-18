# PharmaCare — Persistent Cloud Storage Setup Report

**Repository:** `https://github.com/mudassir-zia-1122/Pharmacare` (base commit `0bb9f96`)  
**Project Root:** `C:\Users\DELL\Desktop\Pharmacy`  
**Storage Architecture:**
1. **Cloudinary** — Doctor profile photographs & public medical images
2. **Cloudflare R2 (Private Bucket)** — Private prescription documents & sensitive clinical uploads

**Date:** 2026-11-18  
**Git / Deploy / DB Status:** **NOT COMMITTED, NOT PUSHED, NOT DEPLOYED, TiDB DATA UNTOUCHED, LOCAL UPLOADS PRESERVED**

---

## 1. Architecture Overview

### Zero Database Schema Changes Required
- **`doctors.profile_photo_url`:** Stores Cloudinary `https://res.cloudinary.com/...` URLs directly (while continuing to support legacy `/uploads/doctors/...` paths via `resolveMediaUrl()` on the frontend).
- **`doctor_inquiries.image_filename` & `prescriptions.prescription_image_path` (`VARCHAR(255)`):** Stores `r2://prescriptions/rx_<ts>_<hex>.<ext>` (~60 chars) for Cloudflare R2 objects, while seamlessly continuing to serve any legacy local filenames from `backend/uploads/prescriptions/` via authenticated endpoints.

---

## 2. Implemented Files & Changes

### New Files (2)
1. `backend/src/services/storage.service.js` — Centralized cloud storage abstraction:
   - **Validation (`validateUploadedFile`, `hasValidMagicBytes`):** Enforces non-empty buffer, 5 MB max size, MIME allowlist, extension allowlist, AND binary magic-byte header verification (JPEG `FF D8 FF`, PNG `89 50 4E 47`, GIF `GIF87a/89a`, WEBP `RIFF..WEBP`, PDF `%PDF-`) to reject spoofed files.
   - **Cloudinary Adapter (`uploadDoctorPhoto`):** Streams doctor photos to `CLOUDINARY_DOCTOR_FOLDER` (`pharmacare/doctors`) and returns HTTPS `secure_url`. Fails explicitly (`503`) in production if unconfigured (never silently writing to Render Free's ephemeral disk).
   - **Cloudflare R2 Private Adapter (`uploadPrivatePrescription`, `getPrivatePrescriptionStream`, `getPrivatePrescriptionSignedUrl`):** Uploads prescriptions privately (`CacheControl: 'private, no-store'`, `ContentDisposition: 'attachment'`, no public ACL), streams authenticated downloads via `GetObjectCommand`, and generates short-lived presigned URLs strictly clamped to **30–300 seconds** (default `120`s).
   - **Local Development Fallback:** Automatically writes/reads under `backend/uploads/` when `NODE_ENV !== 'production'` and cloud credentials are unset, keeping local development effortless.
   - **Sanitized Status (`getStorageConfigStatus`):** Reports provider readiness without ever exposing secrets.
2. `backend/src/tests/storage.test.js` — Automated unit & HTTP security tests covering config sanitization, MIME/extension/size/magic-byte validation, Cloudinary upload & outage handling, Cloudflare R2 upload/stream/signed-URL TTL clamping/outage/traversal protection, and unauthenticated endpoint rejection (`401`/`403`).

### Modified Files (9)
1. `backend/package.json` & `backend/package-lock.json` — Added official SDKs: `cloudinary`, `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`.
2. `backend/src/config/upload.js` — Switched Multer to `multer.memoryStorage()` (5 MB limit, 1 file max, strict allowlists) so `storage.service.js` validates magic bytes and streams directly to cloud storage without orphaned temp files.
3. `backend/src/controllers/doctor.controller.js` — Wired `uploadDoctorPhoto` to `storageService.uploadDoctorPhoto(req.file)`.
4. `backend/src/services/inquiry.service.js` — Wired prescription uploads to `storageService.uploadPrivatePrescription(file)` **after** input validation so invalid submissions never upload orphaned files to R2.
5. `backend/src/controllers/inquiry.controller.js` — Updated `streamInquiryImage` to stream via `storageService.getPrivatePrescriptionStream()` (supports both `r2://` and legacy local files) and optional `?format=signed-url` for short-lived R2 signed URLs.
6. `backend/src/controllers/prescription.controller.js` & `backend/src/routes/prescription.routes.js` — Updated `GET /api/v1/prescriptions/files/:filename` to stream through `storageService` and added `GET /api/v1/prescriptions/signed-url?key=r2://...` (both strictly protected by `authenticate` + `hasRole(ADMIN, PHARMACIST, DOCTOR)`).
7. `backend/.env.example` — Documented all Cloudinary and Cloudflare R2 environment variable names using sanitized placeholders only.

---

## 3. Required Manual Dashboard Configuration

### Step A — Cloudinary Setup (Doctor Profile Photos & Public Medical Images)
1. Create or log into a free **Cloudinary** account (`https://cloudinary.com`).
2. Open **Dashboard / Programmable Media → API Keys** and note:
   - `Cloud Name` -> `CLOUDINARY_CLOUD_NAME`
   - `API Key` -> `CLOUDINARY_API_KEY`
   - `API Secret` -> `CLOUDINARY_API_SECRET`
3. *(Recommended)* In **Settings → Security**, enable **HTTPS-only delivery**.
4. Default upload folder is `pharmacare/doctors` (override via `CLOUDINARY_DOCTOR_FOLDER` if desired).
5. **Never** put `CLOUDINARY_API_KEY` or `CLOUDINARY_API_SECRET` in Vercel / frontend environment variables.

### Step B — Cloudflare R2 Setup (Private Prescription Documents)
1. Log into **Cloudflare Dashboard** (`https://dash.cloudflare.com`) → **R2 Object Storage**.
2. Click **Create bucket**:
   - Bucket Name: `pharmacare-private-prescriptions` (or your chosen name -> `R2_PRIVATE_BUCKET`).
   - Location: Automatic / closest to Asia-Pacific (matches your `ap-southeast-1` TiDB cluster).
   - **CRITICAL:** Keep **Public Access / R2.dev Subdomain DISABLED** and do **NOT** attach a custom public domain! Prescriptions must remain 100% private.
3. Note your **Account ID** (from the R2 overview URL / right sidebar) -> `R2_ACCOUNT_ID`.
4. Go to **R2 → Manage R2 API Tokens → Create API token**:
   - Permissions: **Object Read & Write**
   - Specify bucket(s): **Apply to specific buckets only** → select `pharmacare-private-prescriptions` (least-privilege scoping!).
   - TTL: Choose rotation schedule (e.g., 1 year).
5. Save the generated credentials directly into Render (never into Git):
   - `Access Key ID` -> `R2_ACCESS_KEY_ID`
   - `Secret Access Key` -> `R2_SECRET_ACCESS_KEY`

### Step C — Environment Variables to Add in Render Dashboard (Backend Only)

| Variable Name | Required | Sanitized Example | Purpose |
| :--- | :---: | :--- | :--- |
| `CLOUDINARY_CLOUD_NAME` | **Yes (Prod)** | `<your_cloud_name>` | Cloudinary account identifier |
| `CLOUDINARY_API_KEY` | **Yes (Prod)** | `<your_api_key>` | Cloudinary API key (backend only) |
| `CLOUDINARY_API_SECRET` | **Yes (Prod)** | `<your_api_secret>` | Cloudinary API secret (backend only) |
| `CLOUDINARY_DOCTOR_FOLDER` | Optional | `pharmacare/doctors` | Cloudinary target folder |
| `R2_ACCOUNT_ID` | **Yes (Prod)** | `<your_cloudflare_account_id>` | Builds `https://<id>.r2.cloudflarestorage.com` |
| `R2_ENDPOINT` | Optional | `https://<id>.r2.cloudflarestorage.com` | Overrides default endpoint if needed |
| `R2_ACCESS_KEY_ID` | **Yes (Prod)** | `<your_r2_access_key_id>` | Scoped R2 bucket read/write key |
| `R2_SECRET_ACCESS_KEY` | **Yes (Prod)** | `<your_r2_secret_access_key>` | Scoped R2 secret key |
| `R2_PRIVATE_BUCKET` | **Yes (Prod)** | `pharmacare-private-prescriptions` | Private R2 bucket name |
| `R2_PRESCRIPTION_PREFIX` | Optional | `prescriptions` | Key prefix inside private bucket |
| `R2_SIGNED_URL_TTL_SECONDS` | Optional | `120` | Presigned URL lifetime (enforced 30–300s) |

> **Frontend (Vercel):** Zero new storage variables are needed on Vercel! All uploads and authenticated prescription streams/signing pass strictly through the Render backend API.

---

## 4. Safe Migration Plan for Existing Local Files (Manual, Non-Destructive)

Current local upload counts verified during setup: `0` files in `backend/uploads/doctors/` and `0` files in `backend/uploads/prescriptions/`. If any local files exist later before cutover, follow this zero-data-loss migration procedure:

1. **Take a Backup First:** Archive `backend/uploads/` and run a TiDB logical backup (`npm run backup:db`) before touching any file or record.
2. **Verify Cloud Credentials in Staging/Local:** Temporarily load Cloudinary & R2 credentials in local `backend/.env` and verify `getStorageConfigStatus()` reports `cloudinaryConfigured: true` and `r2Configured: true`.
3. **Migrate Doctor Photos (Idempotent Dry-Run First):**
   - Query `SELECT id, profile_photo_url FROM doctors WHERE profile_photo_url LIKE '/uploads/doctors/%'`.
   - For each existing local file, upload via `storageService.uploadDoctorPhoto(...)` to Cloudinary, verify HTTP `200` on the returned `secure_url`, and update `doctors.profile_photo_url` inside a transaction.
4. **Migrate Private Prescriptions (Idempotent Dry-Run First):**
   - Query `SELECT id, image_filename, image_original_name, image_mime_type FROM doctor_inquiries WHERE image_filename IS NOT NULL AND image_filename NOT LIKE 'r2://%'`.
   - Upload each local file via `storageService.uploadPrivatePrescription(...)` to Cloudflare R2, verify `getPrivatePrescriptionStream(storageKey)` succeeds, and update `doctor_inquiries.image_filename = storageKey` (repeat for `prescriptions.prescription_image_path` if populated).
5. **Retain Local Files Until Post-Deploy Verification:** Keep `backend/uploads/` intact locally as an offline archive; never auto-delete local uploads.

---

## 5. Verification & Test Results

| Verification Check | Command / Scope | Result | Details |
| :--- | :--- | :---: | :--- |
| **Storage Abstraction Suite** | `cd backend && node --test src/tests/storage.test.js` | **PASS** | `5/5` tests passed (`5.04s`): config sanitization, MIME/ext/5MB/magic-byte validation, Cloudinary upload & failure handling, Cloudflare R2 upload/stream/signed-URL TTL clamping/outage/traversal checks, and unauthenticated route blocking (`401`/`403`). |
| **Complete Backend Test Suite** | `cd backend && npm test` | **PASS** | **`42/42` tests passed**, `0` failures (`17.48s`) — all existing POS, FEFO, financial math, email, RBAC, safety, security remediation, and new cloud storage tests pass together. |
| **Frontend Secret Scan** | Scanned `frontend/src/**` for `CLOUDINARY`, `R2_ACCESS`, `R2_SECRET`, `r2.cloudflarestorage` | **PASS** | `0` matches — zero storage secrets or private endpoints exposed in frontend code. |
| **Local Development Parity** | `getStorageConfigStatus({ NODE_ENV: 'development' })` | **PASS** | Automatically resolves to `local_dev` when cloud env vars are omitted, while production (`NODE_ENV=production`) fails closed (`503`) until Cloudinary & R2 are configured. |
| **Database & Local Files Integrity** | Read-only verification | **PASS** | Existing TiDB schema/data untouched; no local uploads deleted or auto-migrated. |

---

## 6. Readiness & Next Steps

- **Code Integration Status:** **PASS (Ready to Commit)**
- **Dashboard Credentials Status:** **MANUAL CONFIGURATION REQUIRED** (Step A Cloudinary + Step B Cloudflare R2 + Step C Render env vars)
- **Next Step:** Please confirm when you are ready for me to commit and push this persistent storage integration to `origin master` (and let me know once you have created the Cloudinary account & Cloudflare R2 private bucket if you'd like help verifying the live Render + Vercel deployment).
