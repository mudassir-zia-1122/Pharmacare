# PharmaCare — Enterprise Pharmacy Management System

[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-v19.0-blue.svg)](https://react.dev/)
[![MySQL](https://img.shields.io/badge/MySQL-8.0%2B-orange.svg)](https://www.mysql.com/)
[![Express.js](https://img.shields.io/badge/Express-4.21-lightgrey.svg)](https://expressjs.com/)
[![License](https://img.shields.io/badge/License-Proprietary-red.svg)]()

PharmaCare is a full-featured, high-reliability Pharmacy Management & Clinical Inventory System designed to meet stringent pharmaceutical safety standards, regulatory drug traceability protocols, and First-Expiry-First-Out (FEFO) dispensing rules.

---

## Key Modules & Features

- **Medicine Catalogue & Classification:** 24+ standard pharmaceutical categories and dosage forms (Tablets, Syrups, Inhalers, Injections, Ointments, Eye Drops, etc.) with multi-brand and strength tracking.
- **Bulk CSV Importer:** Automated CSV import utility with live client-side data preview, schema validation, and multi-field duplicate detection (SKU, barcode, generic+brand combination).
- **FEFO Batch-Wise Inventory:** Strict First-Expiry-First-Out batch allocation. Database-level triggers prevent dispensing expired, recalled, or quarantined batches.
- **Inventory Valuation & Expiry Alerts:** Real-time calculation of Saleable Inventory Value vs. Blocked Inventory Value, with 30/60/90-day expiry countdown notifications.
- **Doctor Prescription Photo Inquiry Portal:** Public, non-authenticated portal (`/check-availability`) allowing clinics and physicians to upload prescription photos (JPEG, PNG, WEBP, PDF) and receive unique reference tracking numbers (`INQ-YYYYMMDD-XXXX`).
- **Pharmacist Live Review & Email Dispatch:** Protected review queue for pharmacists to inspect prescription photos, match items to live stock, and email itemized availability reports via Nodemailer.
- **Point of Sale (POS) & Financial Accuracy:** Real-time billing with verified doctor prescription checks, barcode scanner support, and decimal rounding precision.
- **Immutable Stock Movements Ledger:** Full audit trails tracking every sales deduction, physical inventory count adjustment, supplier receipt, customer return, and expired-stock disposal.

---

## Tech Stack

- **Frontend:** React 19, Vite, Tailwind CSS v4, Lucide Icons, Recharts, Axios.
- **Backend:** Node.js (ES Modules), Express.js, Helmet, Express-Rate-Limit, Multer, Nodemailer, Bcryptjs, JSONWebToken.
- **Database:** MySQL 8.0+ / MariaDB 10.4+ with transactional row-level locking (`FOR UPDATE`) and database triggers.
- **Authentication:** Dual support for MySQL-backed RBAC (`admin`, `pharmacist`, `stock_manager`, `cashier`) and Firebase Auth.

---

## Project Structure

```
Pharmacy/
├── backend/
│   ├── src/
│   │   ├── config/          # Database connection, upload & constants
│   │   ├── controllers/     # Route handlers
│   │   ├── middleware/      # Auth, RBAC, rate limiting, error handlers
│   │   ├── routes/          # Express route definitions
│   │   ├── services/        # Business logic & database operations
│   │   ├── tests/           # Automated safety & unit tests
│   │   ├── utils/           # Math & API response wrappers
│   │   └── server.js        # Application entrypoint
│   ├── scripts/             # Database backup & restore utilities
│   ├── uploads/             # Secure private prescription files
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── api/             # Unified HTTP client & endpoints
│   │   ├── components/      # Common UI components & layouts
│   │   ├── context/         # Auth, Theme, Settings contexts
│   │   ├── pages/           # Application views (POS, Inquiries, Inventory, etc.)
│   │   └── routes/          # React Router route hierarchy
│   ├── vite.config.js
│   └── package.json
├── database/
│   ├── migrations/          # Schema version migrations
│   ├── scripts/             # PowerShell backup & restore wrappers
│   └── backups/             # Timestamped SQL snapshots
└── docs/
    ├── DEPLOYMENT.md        # Production hosting & infrastructure runbook
    └── DATABASE_BACKUP_RESTORE.md # Backup, verification & disaster recovery
```

---

## Quick Start (Development)

### Prerequisites
- Node.js v18.0 or higher
- MySQL / MariaDB (via XAMPP or standalone service running on port 3306)

### 1. Database Setup
Ensure MySQL is started, then initialize the database schema:
```powershell
# In MySQL shell or phpMyAdmin:
CREATE DATABASE pharmacare_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# Apply migrations from project directory:
Get-Content database\001_phase3_schema.sql | mysql.exe -u root pharmacare_db
Get-Content database\migrations\001_inquiries_and_categories.sql | mysql.exe -u root pharmacare_db
```

### 2. Backend Setup
```bash
cd backend
npm install
cp .env.example .env
# Edit .env to set your database credentials
npm run dev
```
Backend API will start on `http://localhost:5000` (Health Check: `http://localhost:5000/api/v1/health`).

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Frontend will open on `http://localhost:5173`.

---

## Testing & Quality Assurance

### Run Backend Unit & Safety Tests
```bash
cd backend
npm test
```
*Executes FEFO allocation tests, financial precision math tests, RBAC middleware checks, and regulatory safety audit tests (14/14 passing).*

### Run Frontend Production Build
```bash
cd frontend
npm run build
```
*Compiles and optimizes the React SPA bundle with zero TypeScript/syntax errors into `frontend/dist`.*

---

## Database Backup & Recovery

- **Create a timestamped backup:**
  ```bash
  cd backend && npm run backup:db
  ```
- **Verify backup integrity (safe, non-destructive test into isolated database):**
  ```bash
  cd backend && npm run restore:db
  ```
For complete disaster recovery documentation and scheduling instructions, see [docs/DATABASE_BACKUP_RESTORE.md](docs/DATABASE_BACKUP_RESTORE.md).

---

## Production Deployment

For complete Linux VPS provisioning, Nginx configuration, SSL setup with Let's Encrypt, and PM2 process management, refer to the [Production Deployment Guide](docs/DEPLOYMENT.md).

---

## Default Development Credentials

| Role | Username | Password | Purpose |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin` | `Password123!` | System configuration, bulk import, user management |
| **Pharmacist** | `pharmacist` | `Password123!` | Prescription review, medicine catalogue, POS dispensing |
| **Stock Manager** | `stock_manager` | `Password123!` | Batch receipt, purchase orders, inventory audit |
| **Cashier** | `cashier` | `Password123!` | Standard POS transactions and sales receipts |

*Note: In production environments, default passwords must be changed immediately upon first login.*
