# PharmaCare — Database Backup, Retention & Disaster Recovery Runbook

This guide documents the procedures for backing up, verifying, and recovering the **PharmaCare** MySQL database (`pharmacare_db`) in accordance with pharmaceutical regulatory and audit requirements.

---

## 1. Safety Principles & Architecture

1. **Zero Hardcoded Credentials:** The backup and restore utilities read configuration directly from `backend/.env` without exposing passwords in shell command lines, logs, or process table arguments.
2. **Atomic Snapshots:** Backups utilize `--single-transaction` and `--quick` flags, guaranteeing transactional consistency across tables without locking active clinical or dispensing transactions.
3. **Outside Public Web Roots:** All dump files are saved in `database/backups/`, completely isolated from frontend assets and the public internet.
4. **Non-Destructive Testing:** The verification command restores dumps into an isolated verification database (`pharmacare_test_restore_db`) and will **never** overwrite the live production database unless explicit override flags are supplied.
5. **Git Ignored:** `database/backups/`, `*.sql`, `*.dump`, and `*.gz` are strictly excluded in `.gitignore` to prevent data leakage to version control.

---

## 2. On-Demand Backup Execution

### Option A: Using NPM (Recommended - Cross-Platform)
From the `backend` directory:
```bash
npm run backup:db
```

### Option B: Using PowerShell (Windows)
From the project root:
```powershell
.\database\scripts\backup.ps1
```

### What Happens During Backup:
1. Validates MySQL connection parameters.
2. Generates a timestamped file: `database/backups/pharmacare_backup_YYYYMMDD_HHMMSS.sql`.
3. Dumps all tables, triggers (including safety check triggers `trg_prevent_blocked_batch_sale` and `trg_deduct_stock_on_sale`), routines, and events.
4. Verifies the generated file is valid and non-empty.
5. Automatically executes retention pruning according to `BACKUP_RETENTION_DAYS`.

---

## 3. Non-Destructive Restore & Integrity Verification

To verify that a backup file is valid and can be restored without touching active operational data:

### Option A: Restore into Test Verification Database
```bash
cd backend
npm run restore:db
```
Or specify a specific backup file:
```bash
node scripts/restore-db.js ../database/backups/pharmacare_backup_20261021_174359.sql
```

### Option B: Using PowerShell
```powershell
.\database\scripts\restore.ps1 -BackupFile "database\backups\pharmacare_backup_20261021_174359.sql"
```

### Verification Checks Performed:
- Creates `pharmacare_test_restore_db` (if missing).
- Imports the full SQL dump.
- Queries and prints the exact table count and record counts for:
  - Users & Staff Roles
  - Medicine Catalogue
  - Categories & Dosage Forms
  - Active Inventory Batches
  - Doctor Prescription Inquiries
  - Database Safety Triggers

---

## 4. Production Disaster Recovery Runbook

In the critical event of hardware failure, ransomware, or catastrophic data corruption, follow these recovery steps:

> [!CAUTION]
> The following command will replace tables in the active database. Obtain executive/pharmacist-in-charge sign-off before proceeding.

1. **Stop the Application Services:**
   ```bash
   # Stop Node.js backend to prevent concurrent writes during restore
   pm2 stop pharmacare-backend  # or stop the service
   ```

2. **Select the Most Recent Verified Backup:**
   Navigate to `database/backups/` and select the latest timestamped `.sql` file.

3. **Restore to Active Production Database:**
   ```bash
   cd backend
   node scripts/restore-db.js --db pharmacare_db --force-production ../database/backups/pharmacare_backup_YYYYMMDD_HHMMSS.sql
   ```

4. **Verify Health & Restart Services:**
   ```bash
   # Run automated test suite
   npm test
   # Start backend
   pm2 restart pharmacare-backend
   ```
5. Confirm operational status by querying `GET /api/v1/health`.

---

## 5. Automated Scheduled Backups

### A. Windows Task Scheduler (XAMPP / Windows Server)
To automate daily backups at 02:00 AM:
1. Open **Windows Task Scheduler** (`taskschd.msc`).
2. Click **Create Basic Task...** and name it `PharmaCare-Daily-DB-Backup`.
3. Set Trigger to **Daily** at `02:00:00`.
4. Set Action to **Start a program**:
   - **Program/script:** `powershell.exe`
   - **Add arguments:** `-ExecutionPolicy Bypass -File "C:\Users\DELL\Desktop\Pharmacy\database\scripts\backup.ps1"`
   - **Start in:** `C:\Users\DELL\Desktop\Pharmacy\backend`
5. Check **Run whether user is logged on or not** and save.

### B. Linux / VPS Cron Job (Ubuntu / Debian / Docker)
Add the following line to the crontab (`crontab -e`):
```cron
# Run daily database backup at 2:00 AM
0 2 * * * cd /var/www/pharmacare/backend && /usr/bin/node scripts/backup-db.js >> /var/log/pharmacare_backup.log 2>&1
```

---

## 6. Retention Policy & Offsite Storage Recommendations

### Retention Policy
- **Daily Backups:** Retain for 30 days locally (`BACKUP_RETENTION_DAYS=30`).
- **Weekly Archives:** Retain for 12 weeks.
- **Monthly Archives:** Retain for 5 years per pharmaceutical drug safety and accounting regulations.

### Recommended Offsite Targets
Never store backups exclusively on the local machine hosting the application.
- **AWS S3 / Cloudflare R2:** Configure an automated sync script using AWS CLI:
  ```bash
  aws s3 sync ../database/backups/ s3://pharmacare-secure-backups/database/ --sse AES256
  ```
- **Encrypted Remote SFTP:** Sync to a dedicated remote backup storage server using encrypted SSH keys.
