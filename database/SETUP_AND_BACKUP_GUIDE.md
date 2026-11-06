# PharmaCare — Windows Database Setup & Backup Guide

> **Phase 3 Deliverable**
> **Target Database:** `pharmacare_db`
> **Prepared for:** Beginner Developer & System Administrator

---

## 1. Environment Status Check Results

We performed a diagnostic inspection of your Windows computer:

| Component | Status | Finding |
|---|---|---|
| **Standalone MySQL Service** | ❌ Not Installed | No dedicated Windows service named `mysql` or `MySQL80` |
| **XAMPP Installation** | ✅ **Detected at `C:\xampp`** | XAMPP is already installed on your system! |
| **XAMPP MySQL / MariaDB Binary** | ✅ Present | `C:\xampp\mysql\bin\mysql.exe` (MariaDB 10.4.32 — MySQL compatible) |
| **MySQL Service Running Status** | ⏸️ **Currently Stopped** | Port 3306 is closed; server process `mysqld` is not active |

> [!TIP]
> **Good news!** Because XAMPP is already on your machine, you **do not need to download or install any new software**. You can simply start MySQL with one click inside XAMPP Control Panel.

---

## 2. Beginner Step-by-Step Setup Guide

Follow these 4 simple steps to start MySQL and load your database:

### Step 1: Start MySQL in XAMPP
1. Open the Windows Start Menu, search for **XAMPP Control Panel**, and open it.
   *(Or press `Win + R`, paste `C:\xampp\xampp-control.exe`, and press Enter).*
2. Look for the row that says **MySQL**.
3. Click the **Start** button next to MySQL.
4. When the word **MySQL** turns green and displays Port `3306`, MySQL is running and ready.

---

### Step 2: Test the Connection
Open PowerShell and run:
```powershell
& "C:\xampp\mysql\bin\mysqladmin.exe" -u root ping
```
**Expected Output:**
```text
mysqld is alive
```

---

### Step 3: Create the Schema and Tables
In PowerShell, run the following single command to execute `database/schema.sql`:
```powershell
Get-Content "c:\Users\DELL\Desktop\Pharmacy\database\schema.sql" | & "C:\xampp\mysql\bin\mysql.exe" -u root
```
*(If your root user has a password, add `-p` to the command).*

---

### Step 4: Load Sample Development Data (Seed)
Run this command to load safe, fictional demonstration data:
```powershell
Get-Content "c:\Users\DELL\Desktop\Pharmacy\database\seed.sql" | & "C:\xampp\mysql\bin\mysql.exe" -u root
```

---

## 3. Database Verification & Test Queries

Once you load the schema and seed data, verify everything with these checks:

### Test 1: Verify Table Count (22 Tables)
```powershell
& "C:\xampp\mysql\bin\mysql.exe" -u root -e "USE pharmacare_db; SHOW TABLES;"
```
You should see 22 base tables and 3 views:
```text
audit_logs, batches, categories, customers, dosage_forms,
manufacturers, medicine_barcodes, medicine_packages, medicines,
payments, permissions, pharmacy_settings, prescriptions,
prescription_items, purchase_order_items, purchase_orders,
role_permissions, roles, return_items, returns, sale_items,
sales, stock_movements, suppliers, tax_rules, users
```

### Test 2: Test FEFO View Query
```powershell
& "C:\xampp\mysql\bin\mysql.exe" -u root -e "USE pharmacare_db; SELECT batch_number, generic_name, brand_name, expiry_date, quantity_on_hand, days_until_expiry FROM v_active_stock_fefo LIMIT 5;"
```
**Verification:** Records appear strictly in ascending order of `expiry_date` (earliest expiry first).

### Test 3: Test Safety Trigger (Attempting to Sell Recalled or Expired Stock)
Run this query to test that the database rejects dispensing recalled stock:
```powershell
& "C:\xampp\mysql\bin\mysql.exe" -u root -e "
USE pharmacare_db;
INSERT INTO sales (invoice_number, cashier_user_id, total_amount) VALUES ('TEST-INV-001', 1, 450.00);
-- Batch 12 is RECALLED (CLR-2024-05). The trigger MUST throw an error here:
INSERT INTO sale_items (sale_id, batch_id, medicine_id, quantity, unit_price, line_total)
VALUES (LAST_INSERT_ID(), 12, 12, 1, 450.00, 450.00);
"
```
**Expected Error:**
```text
ERROR 1644 (45000): PHARMACY SAFETY ERROR: Cannot dispense an inactive, expired, recalled, or quarantined batch.
```
This proves that pharmacy safety rules are locked into the database engine and cannot be bypassed.

---

## 4. Database Backup & Disaster Recovery Guide

In a pharmacy, losing sales data or inventory history is unacceptable. A robust backup strategy is mandatory.

### 4.1 Manual Backup Command (On Demand)
To take an immediate full database snapshot:
```powershell
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
& "C:\xampp\mysql\bin\mysqldump.exe" -u root --routines --triggers --single-transaction pharmacare_db > "c:\Users\DELL\Desktop\Pharmacy\database\backup_pharmacare_$timestamp.sql"
```

### 4.2 Automated Daily Backup Script (`backup_db.ps1`)
Save the following script to schedule daily backups via Windows Task Scheduler:

```powershell
# File: c:\Users\DELL\Desktop\Pharmacy\database\backup_db.ps1
$BackupDir = "c:\Users\DELL\Desktop\Pharmacy\database\backups"
if (!(Test-Path $BackupDir)) { New-Item -ItemType Directory -Path $BackupDir }

$DateStr = Get-Date -Format "yyyy-MM-dd_HH-mm"
$OutputFile = "$BackupDir\pharmacare_db_$DateStr.sql"

Write-Host "Creating backup: $OutputFile"
& "C:\xampp\mysql\bin\mysqldump.exe" -u root --routines --triggers --single-transaction pharmacare_db > $OutputFile

# Retain backups for 30 days, purge older
Get-ChildItem -Path $BackupDir -Filter "*.sql" | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) } | Remove-Item -Force
Write-Host "Backup completed successfully."
```

### 4.3 Disaster Recovery / Restore Procedure
If data is ever corrupted or a test database needs rebuilding:
```powershell
# 1. Recreate clean database
& "C:\xampp\mysql\bin\mysql.exe" -u root -e "DROP DATABASE IF EXISTS pharmacare_db; CREATE DATABASE pharmacare_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 2. Restore from backup file
Get-Content "c:\Users\DELL\Desktop\Pharmacy\database\backups\pharmacare_db_2026-10-18_12-00.sql" | & "C:\xampp\mysql\bin\mysql.exe" -u root pharmacare_db
```

---

## 5. Constraints, Assumptions & Decisions Tracker

| # | Item | Status | Architectural Decision |
|---|---|---|---|
| **D1** | **RDBMS Engine** | Confirmed | MySQL 8.0+ / MariaDB 10.4+ with InnoDB. Fully compatible with XAMPP. |
| **D2** | **Base Currency** | Confirmed | Base currency is `PKR`. Multi-currency conversions are handled through dynamic exchange multipliers in the `currencies` table. |
| **D3** | **Tax Strategy** | Confirmed | Tax rates are **never hardcoded**. Stored in `tax_rules` and linked per medicine. Global toggle stored in `pharmacy_settings`. |
| **D4** | **Timezones** | Confirmed | All DB `TIMESTAMP` values are stored in **UTC**. The Node/Express API translates UTC to `Asia/Karachi` for display. |
| **D5** | **FEFO Batch Allocation** | Confirmed | Implemented via `v_active_stock_fefo` view and verified by index `idx_batches_fefo`. Service-level `SELECT FOR UPDATE` ensures concurrency safety. |
| **D6** | **Prescription Privacy** | Confirmed | Restricted access enforced at RBAC layer (`prescriptions:view`, `prescriptions:verify` permissions granted only to `pharmacist` and `admin`). Patient identifiers are never exposed on cashier POS screens. |
| **D7** | **Safety Triggers** | Confirmed | `trg_prevent_blocked_batch_sale` and `trg_deduct_stock_on_sale` actively prevent dispensing expired, recalled, or out-of-stock items. |
| **U1** | **Cloud Replication** | Unresolved | Single-store deployment is targeted for initial phases. Multi-store synchronization will require binlog replication or master-master clustering in future phases. |
