# PharmaCare — Pre-Deployment GitHub Security & Operational Audit Report

**Auditor**: Senior DevOps & Application Security Engineer
**Audit Target**: `C:\Users\DELL\Desktop\Pharmacy`
**Deployment Platforms**: Render (Node.js REST API Backend) & Vercel (React + Vite Frontend)
**Database**: TiDB Cloud Serverless (`pharmacare`)
**Audit Date**: November 2, 2026
**Overall Security Rating**: **READY FOR DEPLOYMENT (WITH PRE-FLIGHT ACTION ITEMS)**

---

## 1. Executive Summary & Verification Matrix

| # | Audit Task | Status | Verdict | Details |
|---|------------|:------:|:-------:|---------|
| **1** | **Active Credentials & Secrets Tracking** | **PASS** | `SAFE` | `.env`, `backend/.env`, and `frontend/.env` are not tracked by Git. |
| **2** | **`.gitignore` Rule Coverage & Protection** | **PASS** | `PROTECTED` | Verified coverage for `.env*`, `node_modules/`, `dist/`, `uploads/`, `certs/`, `*.pem`, `*.key`, `*.sql.gz`, and `database/backups/`. |
| **3** | **Git Commit History Secret Inspection** | **ACTION REQUIRED** | `CHECK REMOTE` | Local branch has no commits (`master` clean slate); remote GitHub repo inspection steps provided. |
| **4** | **Frontend Vite Client Bundle Review** | **PASS** | `ZERO LEAKAGE` | Zero backend secrets (`DB_PASSWORD`, `JWT_SECRET`, `SMTP_PASS`, TiDB host) present in Vite bundle. |
| **5** | **Production Start Command & Scripts** | **PASS** | `VERIFIED` | Production start command identified: `npm start` (`node src/server.js`) inside `backend`. |
| **6** | **Root Directories Identification** | **PASS** | `MAPPED` | Backend Root: `backend/` \| Frontend Root: `frontend/`. |
| **7** | **Zero-Disruption Local Build Verification** | **PASS** | `VALIDATED` | Production build succeeded (`dist/` in 10.67s) with 29/29 unit tests passing without altering local setup. |

---

## 2. Detailed Task Audits & Findings

### Task 1: Tracking of Environment Files, Credentials & API Keys
- **Status**: **PASS**
- **Findings**:
  - The local dry-run staging (`git add --dry-run .`) was executed across the entire repository.
  - `backend/.env` (containing live TiDB credentials, JWT secret, and SMTP settings) is strictly ignored.
  - `frontend/.env` is strictly ignored.
  - Neither `.env.production` nor `.env.local` files are tracked.
  - Only template files (`backend/.env.example` and `frontend/.env.example`) are staged. Both were inspected and verified to contain dummy placeholders (`your_tidb_username`, `your_email@gmail.com`) with zero live credentials.

---

### Task 2: `.gitignore` Protection Audit
- **Status**: **PASS (REINFORCED)**
- **Audit Findings**:
  - All three `.gitignore` layers (`.gitignore`, `backend/.gitignore`, `frontend/.gitignore`) were audited using `git check-ignore -v`.
  - **Enhancement Applied**: Added explicit exclusions for `certs/`, `**/certs/`, `*.pem`, `*.crt`, `*.pfx`, and `*.p12` in both root and backend `.gitignore` files to ensure TLS/SSL certificates and private keys can never be staged or committed.

```
========================================================================================
  .GITIGNORE VERIFICATION EVIDENCE
========================================================================================
  Target File Pattern                        | Matching Ignore Rule              | Status
---------------------------------------------+-----------------------------------+----------
  .env (root)                                | .gitignore:7:.env                 | IGNORED
  backend/.env                               | backend/.gitignore:2:.env         | IGNORED
  backend/.env.production                    | backend/.gitignore:3:.env.*       | IGNORED
  backend/.env.local                         | backend/.gitignore:5:.env.local   | IGNORED
  backend/certs/isrgrootx1.pem               | backend/.gitignore:13:certs/      | IGNORED
  backend/certs/private.key                  | backend/.gitignore:13:certs/      | IGNORED
  backend/uploads/prescriptions/rx_1.jpg     | backend/.gitignore:12:uploads/    | IGNORED
  database/backups/pharmacare_backup_*.sql   | .gitignore:38:database/backups/   | IGNORED
  frontend/.env                              | frontend/.gitignore:16:.env       | IGNORED
  frontend/.env.local                        | frontend/.gitignore:17:.env.*     | IGNORED
  frontend/dist/index.html                   | frontend/.gitignore:11:dist       | IGNORED
  backend/node_modules                       | backend/.gitignore:1:node_modules | IGNORED
========================================================================================
```

---

### Task 3: Git History & Remote GitHub Security
- **Status**: **ACTION REQUIRED**
- **Findings**:
  - Locally, `C:\Users\DELL\Desktop\Pharmacy` is on branch `master` with no commits yet (`fatal: your current branch 'master' does not have any commits yet`).
  - Because you already uploaded the project to GitHub (via web interface, GitHub Desktop, or another machine), the remote repository on GitHub must be checked directly.

> [!WARNING]
> **Action Required on GitHub**:
> 1. Visit your repository: `https://github.com/mudassir-zia-1122/<repo-name>`
> 2. Ensure that neither `.env`, `backend/.env`, nor `frontend/.env` is visible in the repository file tree.
> 3. Click the **Security** tab at the top of your GitHub repository and check **Secret scanning** alerts.
> 4. If a `.env` file was committed to GitHub previously:
>    - **Step 1**: Rotate your TiDB Cloud database password in the TiDB Cloud Console immediately.
>    - **Step 2**: Generate a new random `JWT_SECRET` (minimum 64 characters).
>    - **Step 3**: Revoke and re-issue your Gmail Google App Password.
>    - **Step 4**: Remove the file from GitHub tracking:
>      ```bash
>      git rm --cached backend/.env frontend/.env
>      git commit -m "security: remove sensitive environment files from tracking"
>      git push origin master
>      ```

---

### Task 4: Frontend Vite Client Bundle Review
- **Status**: **PASS (ZERO LEAKAGE)**
- **Audit Findings**:
  - Reviewed all `VITE_` variables in `frontend/.env`. Only client-facing variables (`VITE_API_BASE_URL`, Firebase client keys) are present.
  - Audited `frontend/src` for references to backend environment variables (`DB_HOST`, `DB_PASSWORD`, `JWT_SECRET`, `SMTP_PASS`, `tidbcloud`). Found **0 matches**.
  - Audited the production build bundle (`frontend/dist/assets/index-*.js`) with string analysis. Found **0 leaked backend secrets or database credentials**.

---

### Task 5: Backend `package.json` Scripts & Production Start Command
- **Status**: **PASS**
- **Production Start Command**:
  ```bash
  npm start
  ```
- **Execution Details**:
  - `backend/package.json` specifies `"type": "module"`, `"main": "src/server.js"`, and `"start": "node src/server.js"`.
  - When deployed on Render with Root Directory set to `backend`, `npm start` executes `node src/server.js` using Node.js's built-in ES Modules loader.
  - In production (`NODE_ENV=production`), `src/server.js` disables hot-reloading watchers and runs with performance optimizations.

---

### Task 6: Directory Structure for Render & Vercel
- **Status**: **PASS**

```
C:\Users\DELL\Desktop\Pharmacy\
├── backend/                  <--- [RENDER ROOT DIRECTORY]
│   ├── package.json          (Start script: "node src/server.js")
│   ├── src/server.js         (Express entrypoint on port 5000 or process.env.PORT)
│   └── .env.example
├── frontend/                 <--- [VERCEL ROOT DIRECTORY]
│   ├── package.json          (Build script: "vite build")
│   ├── vite.config.js
│   ├── vercel.json           (SPA rewrite: { source: "/(.*)", destination: "/index.html" })
│   └── dist/                 (Build Output Directory)
└── package.json              (Monorepo workspace root helper)
```

---

### Task 7: Zero-Disruption Local Build & Test Verification
- **Status**: **PASS**
- **Evidence**:
  1. **Frontend Production Build**: Executed `npm run build` in `frontend/`. Compiled cleanly in 10.67s with 0 errors.
  2. **Backend Unit & Safety Suite**: Executed `npm test` (`node --test src/tests/*.test.js`) in `backend/`. All **29 / 29 unit tests passed** (FEFO allocation, financial math decimal rounding, POS checkout rollbacks, RBAC middleware, email security masking).
  3. **Local Dev Environment**: Both development servers (`localhost:5000` and `localhost:5173`) remain 100% operational with no breaking changes to proxying, ports, or dependencies.

---

## 3. Cloud Deployment Blueprint

### Platform 1: Render (Backend REST API)

1. Log into [Render Dashboard](https://dashboard.render.com/) and click **New +** > **Web Service**.
2. Connect your GitHub repository: `mudassir-zia-1122/<repo-name>`.
3. Configure the service parameters:
   - **Name**: `pharmacare-api`
   - **Region**: Choose closest to database (e.g., `Singapore` or `Frankfurt`).
   - **Root Directory**: `backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. Under **Environment Variables**, add:
   ```env
   NODE_ENV=production
   PORT=10000
   API_PREFIX=/api/v1
   DB_HOST=gateway01.ap-southeast-1.prod.aws.tidbcloud.com
   DB_PORT=4000
   DB_USER=<your_tidb_user>
   DB_PASSWORD=<your_tidb_password>
   DB_NAME=pharmacare
   DB_SSL=true
   JWT_SECRET=<generate_a_random_64_character_hex_or_alphanumeric_secret>
   JWT_EXPIRES_IN=8h
   BCRYPT_SALT_ROUNDS=12
   CORS_ORIGIN=https://<your-vercel-app-name>.vercel.app
   RATE_LIMIT_WINDOW_MS=900000
   RATE_LIMIT_MAX_REQUESTS=500
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=carepharma949@gmail.com
   SMTP_PASS=<your_gmail_16_character_app_password>
   EMAIL_FROM="PharmaCare Clinical Pharmacy" <carepharma949@gmail.com>
   PHARMACY_NOTIFICATION_EMAIL=carepharma949@gmail.com
   ```
5. Click **Create Web Service**.
6. Verify deployment by checking: `https://<your-render-name>.onrender.com/api/v1/health`.

---

### Platform 2: Vercel (Frontend React + Vite SPA)

1. Log into [Vercel Dashboard](https://vercel.com/) and click **Add New...** > **Project**.
2. Import your GitHub repository: `mudassir-zia-1122/<repo-name>`.
3. In the project configuration screen:
   - **Framework Preset**: `Vite`
   - **Root Directory**: Click *Edit* and select `frontend`.
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Under **Environment Variables**, add:
   ```env
   VITE_API_BASE_URL=https://<your-render-name>.onrender.com/api/v1
   ```
   *(Optional Firebase keys from `frontend/.env` if using Firebase authentication).*
5. Click **Deploy**.
6. Vercel will build the SPA and supply your production domain (e.g., `https://pharmacare-frontend.vercel.app`).
7. Update `CORS_ORIGIN` on Render with this Vercel domain to permit cross-origin API calls.

---

## 4. Pre-Deployment Security Checklist

- [x] `.env` files removed from Git tracking and ignored.
- [x] Certificates and keys (`certs/`, `*.pem`, `*.key`) ignored.
- [x] Zero backend credentials compiled into frontend JS bundle.
- [x] Production build passes without error (`dist/` generated).
- [x] 29/29 automated backend tests pass.
- [ ] Admin password on live TiDB Cloud updated from default `Password123!`.
- [ ] Remote GitHub repository verified free of committed `.env` files.
- [ ] Render environment variables populated securely in Render Dashboard.
- [ ] Render backend URL set in Vercel `VITE_API_BASE_URL`.
- [ ] Vercel domain added to Render `CORS_ORIGIN`.
