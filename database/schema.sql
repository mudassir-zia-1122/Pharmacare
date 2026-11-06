-- =============================================================================
-- PharmaCare Pharmacy Management System
-- Database Schema: pharmacare_db
-- Target Engine: MySQL 8.0+ / MariaDB 10.4+ (InnoDB Engine)
-- Character Set: utf8mb4 (Unicode Multilingual, emoji & special characters)
-- Collation: utf8mb4_unicode_ci
-- Date: 2026-10-18
-- Phase: 3 (Database Architecture & Setup)
-- =============================================================================

CREATE DATABASE IF NOT EXISTS `pharmacare_db`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `pharmacare_db`;

-- Enforce strict SQL mode for bulletproof data integrity
SET sql_mode = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

-- -----------------------------------------------------------------------------
-- 1. SECURITY & ACCESS CONTROL (RBAC)
-- -----------------------------------------------------------------------------

-- Roles table (Admin, Pharmacist, Stock Manager, Cashier)
CREATE TABLE IF NOT EXISTS `roles` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(50) NOT NULL UNIQUE,
  `display_name` VARCHAR(100) NOT NULL,
  `description` VARCHAR(255) NULL,
  `is_system_role` BOOLEAN NOT NULL DEFAULT FALSE,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Granular permissions table
CREATE TABLE IF NOT EXISTS `permissions` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `code` VARCHAR(100) NOT NULL UNIQUE COMMENT 'e.g. pos:dispense, medicines:edit, rx:verify',
  `module` VARCHAR(50) NOT NULL COMMENT 'e.g. inventory, sales, prescriptions, reports',
  `description` VARCHAR(255) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Role to permissions mapping
CREATE TABLE IF NOT EXISTS `role_permissions` (
  `role_id` INT UNSIGNED NOT NULL,
  `permission_id` INT UNSIGNED NOT NULL,
  PRIMARY KEY (`role_id`, `permission_id`),
  CONSTRAINT `fk_role_perm_role` FOREIGN KEY (`role_id`)
    REFERENCES `roles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_role_perm_perm` FOREIGN KEY (`permission_id`)
    REFERENCES `permissions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Users (Staff & Admin accounts)
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `role_id` INT UNSIGNED NOT NULL,
  `username` VARCHAR(50) NOT NULL UNIQUE,
  `email` VARCHAR(100) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL COMMENT 'bcrypt hash with salt rounds >= 12',
  `full_name` VARCHAR(150) NOT NULL,
  `phone` VARCHAR(30) NULL,
  `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  `last_login_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` TIMESTAMP NULL COMMENT 'Soft-delete timestamp',
  CONSTRAINT `fk_user_role` FOREIGN KEY (`role_id`)
    REFERENCES `roles` (`id`) ON DELETE RESTRICT,
  INDEX `idx_users_role_status` (`role_id`, `status`),
  INDEX `idx_users_username` (`username`)
) ENGINE=InnoDB;

-- Immutable audit logs for legal compliance & security
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT UNSIGNED NULL,
  `action` ENUM('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'VIEW_SENSITIVE', 'STATUS_CHANGE', 'OVERRIDE') NOT NULL,
  `table_name` VARCHAR(64) NOT NULL,
  `record_id` VARCHAR(64) NULL,
  `old_values` JSON NULL COMMENT 'Snapshot of record state before mutation',
  `new_values` JSON NULL COMMENT 'Snapshot of record state after mutation',
  `ip_address` VARCHAR(45) NULL,
  `user_agent` VARCHAR(255) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_audit_user` FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`) ON DELETE SET NULL,
  INDEX `idx_audit_table_record` (`table_name`, `record_id`),
  INDEX `idx_audit_user_created` (`user_id`, `created_at`)
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 2. MASTER REFERENCE & MEDICINE CATALOGUE
-- -----------------------------------------------------------------------------

-- Categories (Analgesics, Antibiotics, Antidiabetics, etc.)
CREATE TABLE IF NOT EXISTS `categories` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL UNIQUE,
  `description` VARCHAR(255) NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Dosage Forms (Tablet, Capsule, Syrup, Ampoule, Vial, Eye Drop, etc.)
CREATE TABLE IF NOT EXISTS `dosage_forms` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL UNIQUE,
  `description` VARCHAR(255) NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Manufacturers (Pharmaceutical companies)
CREATE TABLE IF NOT EXISTS `manufacturers` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(150) NOT NULL UNIQUE,
  `country` VARCHAR(100) NOT NULL DEFAULT 'Pakistan',
  `contact_person` VARCHAR(100) NULL,
  `phone` VARCHAR(50) NULL,
  `email` VARCHAR(100) NULL,
  `license_number` VARCHAR(100) NULL COMMENT 'DRAP / regulatory registration number',
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Currencies (Configurable multi-currency support, base = PKR)
CREATE TABLE IF NOT EXISTS `currencies` (
  `code` CHAR(3) PRIMARY KEY COMMENT 'ISO 4217 code: PKR, USD, EUR, GBP',
  `name` VARCHAR(50) NOT NULL,
  `symbol` VARCHAR(10) NOT NULL,
  `locale` VARCHAR(20) NOT NULL DEFAULT 'ur-PK',
  `exchange_rate` DECIMAL(12,6) NOT NULL DEFAULT 1.000000 COMMENT 'Relative to base currency',
  `is_base` BOOLEAN NOT NULL DEFAULT FALSE,
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Tax Rules (Configurable tax policies, e.g. 0% for life-saving, standard GST)
CREATE TABLE IF NOT EXISTS `tax_rules` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `code` VARCHAR(50) NOT NULL UNIQUE,
  `rate_percent` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `description` VARCHAR(255) NULL,
  `is_default` BOOLEAN NOT NULL DEFAULT FALSE,
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `chk_tax_rate_positive` CHECK (`rate_percent` >= 0.00 AND `rate_percent` <= 100.00)
) ENGINE=InnoDB;

-- Suppliers / Distributors
CREATE TABLE IF NOT EXISTS `suppliers` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(150) NOT NULL,
  `contact_person` VARCHAR(100) NULL,
  `phone` VARCHAR(50) NOT NULL,
  `email` VARCHAR(100) NULL,
  `address` TEXT NULL,
  `city` VARCHAR(100) NOT NULL DEFAULT 'Karachi',
  `tax_ntn_number` VARCHAR(50) NULL,
  `drug_sale_license` VARCHAR(100) NULL,
  `payment_terms` VARCHAR(50) NOT NULL DEFAULT 'Net 30',
  `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  `notes` TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_suppliers_city` (`city`),
  INDEX `idx_suppliers_status` (`status`)
) ENGINE=InnoDB;

-- Customers / Patients
CREATE TABLE IF NOT EXISTS `customers` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(150) NOT NULL,
  `phone` VARCHAR(50) NULL,
  `email` VARCHAR(100) NULL,
  `address` TEXT NULL,
  `cnic_or_id` VARCHAR(50) NULL COMMENT 'National ID for regulated dispensing',
  `is_tax_exempt` BOOLEAN NOT NULL DEFAULT FALSE,
  `notes` TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_customers_phone` (`phone`),
  INDEX `idx_customers_cnic` (`cnic_or_id`)
) ENGINE=InnoDB;

-- Core Medicines Catalogue
CREATE TABLE IF NOT EXISTS `medicines` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `generic_name` VARCHAR(150) NOT NULL,
  `brand_name` VARCHAR(150) NOT NULL,
  `category_id` INT UNSIGNED NOT NULL,
  `dosage_form_id` INT UNSIGNED NOT NULL,
  `manufacturer_id` INT UNSIGNED NULL,
  `strength` VARCHAR(50) NOT NULL COMMENT 'e.g. 500, 250, 100',
  `strength_unit` VARCHAR(20) NOT NULL DEFAULT 'mg' COMMENT 'e.g. mg, mcg, g, ml, IU, %',
  `dosage_description` VARCHAR(255) NULL COMMENT 'e.g. 1 tablet twice daily after meals',
  `pack_size` VARCHAR(100) NULL DEFAULT '10' COMMENT 'e.g. 10, 30, 100',
  `pack_unit` VARCHAR(50) NULL DEFAULT 'Tablets' COMMENT 'e.g. Tablets, Capsules, Sachets, ml',
  `storage_instructions` VARCHAR(255) NULL DEFAULT 'Store below 30°C in a dry place' COMMENT 'Storage & handling',
  `warnings` TEXT NULL COMMENT 'Contraindications, clinical warnings',
  `description` TEXT NULL,
  `barcode` VARCHAR(100) NULL UNIQUE COMMENT 'Primary EAN/UPC barcode',
  `sku` VARCHAR(100) NULL UNIQUE COMMENT 'Stock Keeping Unit identifier',
  `requires_prescription` BOOLEAN NOT NULL DEFAULT FALSE,
  `tax_rule_id` INT UNSIGNED NULL,
  `reorder_level` INT UNSIGNED NOT NULL DEFAULT 50 COMMENT 'Minimum threshold before alert',
  `status` ENUM('active', 'inactive', 'discontinued') NOT NULL DEFAULT 'active',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` TIMESTAMP NULL COMMENT 'Soft-delete timestamp',
  CONSTRAINT `fk_med_category` FOREIGN KEY (`category_id`)
    REFERENCES `categories` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_med_dosage` FOREIGN KEY (`dosage_form_id`)
    REFERENCES `dosage_forms` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_med_mfg` FOREIGN KEY (`manufacturer_id`)
    REFERENCES `manufacturers` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_med_tax_rule` FOREIGN KEY (`tax_rule_id`)
    REFERENCES `tax_rules` (`id`) ON DELETE SET NULL,
  INDEX `idx_med_names` (`generic_name`, `brand_name`),
  INDEX `idx_med_category` (`category_id`),
  INDEX `idx_med_dosage` (`dosage_form_id`),
  INDEX `idx_med_barcode` (`barcode`),
  INDEX `idx_med_status` (`status`)
) ENGINE=InnoDB;

-- Packaging tiers (e.g. 1 Strip = 10 Tablets; 1 Box = 10 Strips = 100 Tablets)
CREATE TABLE IF NOT EXISTS `medicine_packages` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `medicine_id` INT UNSIGNED NOT NULL,
  `package_label` VARCHAR(100) NOT NULL COMMENT 'e.g. Strip of 10, Box of 100, Bottle of 60ml',
  `units_per_package` INT UNSIGNED NOT NULL DEFAULT 1 COMMENT 'Base dispensing units contained',
  `is_default_sale_unit` BOOLEAN NOT NULL DEFAULT FALSE,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_pkg_medicine` FOREIGN KEY (`medicine_id`)
    REFERENCES `medicines` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chk_pkg_units` CHECK (`units_per_package` >= 1)
) ENGINE=InnoDB;

-- Multiple barcodes per medicine (e.g. box barcode vs individual strip barcode)
CREATE TABLE IF NOT EXISTS `medicine_barcodes` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `medicine_id` INT UNSIGNED NOT NULL,
  `package_id` INT UNSIGNED NULL,
  `barcode` VARCHAR(100) NOT NULL UNIQUE,
  `barcode_type` ENUM('EAN13', 'CODE128', 'UPC', 'CUSTOM') NOT NULL DEFAULT 'EAN13',
  `is_primary` BOOLEAN NOT NULL DEFAULT FALSE,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_barcode_med` FOREIGN KEY (`medicine_id`)
    REFERENCES `medicines` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_barcode_pkg` FOREIGN KEY (`package_id`)
    REFERENCES `medicine_packages` (`id`) ON DELETE SET NULL,
  INDEX `idx_barcode_lookup` (`barcode`)
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 3. BATCH INVENTORY & FEFO TRACKING
-- -----------------------------------------------------------------------------

-- Batches: The cornerstone of pharmacy inventory, pricing, and expiry safety
CREATE TABLE IF NOT EXISTS `batches` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `batch_number` VARCHAR(60) NOT NULL,
  `medicine_id` INT UNSIGNED NOT NULL,
  `supplier_id` INT UNSIGNED NULL,
  `manufacturing_date` DATE NULL,
  `expiry_date` DATE NOT NULL,
  `received_date` DATE NOT NULL DEFAULT (CURRENT_DATE),
  `initial_quantity` INT UNSIGNED NOT NULL,
  `quantity_on_hand` INT UNSIGNED NOT NULL,
  `cost_price` DECIMAL(12,2) NOT NULL COMMENT 'Purchase unit cost in base currency',
  `selling_price` DECIMAL(12,2) NOT NULL COMMENT 'Dispensing unit retail price in base currency',
  `status` ENUM('active', 'expired', 'recalled', 'quarantined', 'exhausted') NOT NULL DEFAULT 'active',
  `quarantine_reason` VARCHAR(255) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_batch_medicine` FOREIGN KEY (`medicine_id`)
    REFERENCES `medicines` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_batch_supplier` FOREIGN KEY (`supplier_id`)
    REFERENCES `suppliers` (`id`) ON DELETE SET NULL,
  CONSTRAINT `chk_batch_qty_non_negative` CHECK (`quantity_on_hand` >= 0),
  CONSTRAINT `chk_batch_cost_price` CHECK (`cost_price` >= 0.00),
  CONSTRAINT `chk_batch_selling_price` CHECK (`selling_price` >= 0.00),
  -- Unique constraint: A single medicine cannot have duplicate batch numbers
  UNIQUE KEY `uk_med_batch_number` (`medicine_id`, `batch_number`),
  -- Critical FEFO index: Order by expiry_date ASC for active batches
  INDEX `idx_batches_fefo` (`medicine_id`, `status`, `expiry_date`, `quantity_on_hand`),
  INDEX `idx_batches_expiry` (`expiry_date`, `status`)
) ENGINE=InnoDB;

-- Stock movements: Immutable audit ledger for every unit of inventory change
CREATE TABLE IF NOT EXISTS `stock_movements` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `batch_id` INT UNSIGNED NOT NULL,
  `movement_type` ENUM(
    'PURCHASE_RECEIPT',
    'SALE_DISPENSE',
    'SALE_RETURN',
    'PURCHASE_RETURN',
    'DAMAGE_DISPOSAL',
    'EXPIRED_WRITE_OFF',
    'AUDIT_ADJUSTMENT'
  ) NOT NULL,
  `quantity_change` INT NOT NULL COMMENT 'Signed int: + for additions, - for deductions',
  `previous_quantity` INT UNSIGNED NOT NULL,
  `new_quantity` INT UNSIGNED NOT NULL,
  `reference_type` VARCHAR(50) NOT NULL COMMENT 'e.g. sale, purchase_order, return, adjustment',
  `reference_id` VARCHAR(50) NULL,
  `reason` VARCHAR(255) NULL,
  `performed_by_user_id` INT UNSIGNED NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_movement_batch` FOREIGN KEY (`batch_id`)
    REFERENCES `batches` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_movement_user` FOREIGN KEY (`performed_by_user_id`)
    REFERENCES `users` (`id`) ON DELETE SET NULL,
  INDEX `idx_movements_batch_date` (`batch_id`, `created_at`),
  INDEX `idx_movements_ref` (`reference_type`, `reference_id`),
  INDEX `idx_movements_type` (`movement_type`)
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 4. PURCHASES & INVOICES
-- -----------------------------------------------------------------------------

-- Purchase orders / Invoices received from pharmaceutical distributors
CREATE TABLE IF NOT EXISTS `purchase_orders` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `po_number` VARCHAR(50) NOT NULL UNIQUE,
  `supplier_id` INT UNSIGNED NOT NULL,
  `order_date` DATE NOT NULL DEFAULT (CURRENT_DATE),
  `expected_delivery_date` DATE NULL,
  `received_date` DATE NULL,
  `supplier_invoice_number` VARCHAR(100) NULL,
  `currency_code` CHAR(3) NOT NULL DEFAULT 'PKR',
  `exchange_rate` DECIMAL(12,6) NOT NULL DEFAULT 1.000000,
  `subtotal_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `discount_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `tax_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `total_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `status` ENUM('draft', 'ordered', 'partial', 'received', 'cancelled') NOT NULL DEFAULT 'draft',
  `notes` TEXT NULL,
  `created_by_user_id` INT UNSIGNED NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_po_supplier` FOREIGN KEY (`supplier_id`)
    REFERENCES `suppliers` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_po_currency` FOREIGN KEY (`currency_code`)
    REFERENCES `currencies` (`code`) ON DELETE RESTRICT,
  CONSTRAINT `fk_po_user` FOREIGN KEY (`created_by_user_id`)
    REFERENCES `users` (`id`) ON DELETE RESTRICT,
  INDEX `idx_po_supplier_date` (`supplier_id`, `order_date`),
  INDEX `idx_po_status` (`status`)
) ENGINE=InnoDB;

-- Line items for each purchase order
CREATE TABLE IF NOT EXISTS `purchase_order_items` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `purchase_order_id` INT UNSIGNED NOT NULL,
  `medicine_id` INT UNSIGNED NOT NULL,
  `package_id` INT UNSIGNED NULL,
  `batch_number` VARCHAR(60) NOT NULL,
  `manufacturing_date` DATE NULL,
  `expiry_date` DATE NOT NULL,
  `ordered_quantity` INT UNSIGNED NOT NULL,
  `received_quantity` INT UNSIGNED NOT NULL DEFAULT 0,
  `unit_cost_price` DECIMAL(12,2) NOT NULL,
  `unit_selling_price` DECIMAL(12,2) NOT NULL,
  `tax_rate` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `tax_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `line_total` DECIMAL(12,2) NOT NULL,
  CONSTRAINT `fk_poi_order` FOREIGN KEY (`purchase_order_id`)
    REFERENCES `purchase_orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_poi_medicine` FOREIGN KEY (`medicine_id`)
    REFERENCES `medicines` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_poi_package` FOREIGN KEY (`package_id`)
    REFERENCES `medicine_packages` (`id`) ON DELETE SET NULL,
  CONSTRAINT `chk_poi_ordered_qty` CHECK (`ordered_quantity` > 0),
  CONSTRAINT `chk_poi_cost_price` CHECK (`unit_cost_price` >= 0.00)
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 5. PRESCRIPTION RECORDS (RESTRICTED ACCESS)
-- -----------------------------------------------------------------------------

-- Prescription records required for restricted medical audit compliance
CREATE TABLE IF NOT EXISTS `prescriptions` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `prescription_number` VARCHAR(50) NOT NULL UNIQUE,
  `customer_id` INT UNSIGNED NULL,
  `patient_name` VARCHAR(150) NOT NULL,
  `patient_age` INT UNSIGNED NULL,
  `patient_gender` ENUM('male', 'female', 'other') NULL,
  `patient_phone` VARCHAR(50) NULL,
  `doctor_name` VARCHAR(150) NOT NULL,
  `doctor_license_no` VARCHAR(100) NULL COMMENT 'PMDC / regulatory registration',
  `clinic_or_hospital` VARCHAR(200) NULL,
  `prescription_date` DATE NOT NULL,
  `prescription_image_path` VARCHAR(255) NULL COMMENT 'Secure encrypted local path',
  `is_verified` BOOLEAN NOT NULL DEFAULT FALSE,
  `verified_by_user_id` INT UNSIGNED NULL COMMENT 'Must be Pharmacist or Admin',
  `verified_at` TIMESTAMP NULL,
  `status` ENUM('pending', 'verified', 'dispensed', 'cancelled') NOT NULL DEFAULT 'pending',
  `notes` TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_rx_customer` FOREIGN KEY (`customer_id`)
    REFERENCES `customers` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_rx_verified_by` FOREIGN KEY (`verified_by_user_id`)
    REFERENCES `users` (`id`) ON DELETE SET NULL,
  INDEX `idx_rx_status_date` (`status`, `prescription_date`),
  INDEX `idx_rx_patient` (`patient_name`)
) ENGINE=InnoDB;

-- Line items prescribed on a prescription
CREATE TABLE IF NOT EXISTS `prescription_items` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `prescription_id` INT UNSIGNED NOT NULL,
  `medicine_id` INT UNSIGNED NULL,
  `prescribed_medicine_name` VARCHAR(200) NOT NULL,
  `dosage_instructions` VARCHAR(255) NULL COMMENT 'e.g. 1 tablet twice daily after meals',
  `prescribed_quantity` INT UNSIGNED NOT NULL DEFAULT 1,
  `dispensed_quantity` INT UNSIGNED NOT NULL DEFAULT 0,
  CONSTRAINT `fk_pxi_prescription` FOREIGN KEY (`prescription_id`)
    REFERENCES `prescriptions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pxi_medicine` FOREIGN KEY (`medicine_id`)
    REFERENCES `medicines` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 6. POINT OF SALE (POS) BILLING & SALES
-- -----------------------------------------------------------------------------

-- Sales invoices header
CREATE TABLE IF NOT EXISTS `sales` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `invoice_number` VARCHAR(50) NOT NULL UNIQUE,
  `customer_id` INT UNSIGNED NULL,
  `sale_timestamp` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `currency_code` CHAR(3) NOT NULL DEFAULT 'PKR',
  `exchange_rate` DECIMAL(12,6) NOT NULL DEFAULT 1.000000,
  `subtotal_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `discount_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `tax_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `total_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `payment_status` ENUM('paid', 'partially_paid', 'unpaid', 'refunded') NOT NULL DEFAULT 'paid',
  `status` ENUM('completed', 'partially_returned', 'fully_returned', 'cancelled') NOT NULL DEFAULT 'completed',
  `has_prescription_items` BOOLEAN NOT NULL DEFAULT FALSE,
  `prescription_id` INT UNSIGNED NULL,
  `cashier_user_id` INT UNSIGNED NOT NULL,
  `notes` TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_sale_customer` FOREIGN KEY (`customer_id`)
    REFERENCES `customers` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_sale_currency` FOREIGN KEY (`currency_code`)
    REFERENCES `currencies` (`code`) ON DELETE RESTRICT,
  CONSTRAINT `fk_sale_rx` FOREIGN KEY (`prescription_id`)
    REFERENCES `prescriptions` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_sale_cashier` FOREIGN KEY (`cashier_user_id`)
    REFERENCES `users` (`id`) ON DELETE RESTRICT,
  INDEX `idx_sales_date` (`sale_timestamp`),
  INDEX `idx_sales_cashier` (`cashier_user_id`),
  INDEX `idx_sales_status` (`status`)
) ENGINE=InnoDB;

-- Sale line items: Locked directly to the specific dispensed batch
CREATE TABLE IF NOT EXISTS `sale_items` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `sale_id` INT UNSIGNED NOT NULL,
  `batch_id` INT UNSIGNED NOT NULL,
  `medicine_id` INT UNSIGNED NOT NULL,
  `quantity` INT UNSIGNED NOT NULL,
  `unit_price` DECIMAL(12,2) NOT NULL,
  `discount_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `tax_rate` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `tax_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `line_total` DECIMAL(12,2) NOT NULL,
  `returned_quantity` INT UNSIGNED NOT NULL DEFAULT 0,
  CONSTRAINT `fk_si_sale` FOREIGN KEY (`sale_id`)
    REFERENCES `sales` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_si_batch` FOREIGN KEY (`batch_id`)
    REFERENCES `batches` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_si_medicine` FOREIGN KEY (`medicine_id`)
    REFERENCES `medicines` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `chk_si_quantity` CHECK (`quantity` > 0),
  CONSTRAINT `chk_si_returned_qty` CHECK (`returned_quantity` <= `quantity`),
  INDEX `idx_si_batch` (`batch_id`),
  INDEX `idx_si_medicine` (`medicine_id`)
) ENGINE=InnoDB;

-- Payment transactions attached to a sale
CREATE TABLE IF NOT EXISTS `payments` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `sale_id` INT UNSIGNED NOT NULL,
  `payment_method` ENUM('cash', 'card', 'bank_transfer', 'mobile_wallet', 'credit') NOT NULL DEFAULT 'cash',
  `amount` DECIMAL(12,2) NOT NULL,
  `currency_code` CHAR(3) NOT NULL DEFAULT 'PKR',
  `transaction_reference` VARCHAR(100) NULL,
  `received_by_user_id` INT UNSIGNED NOT NULL,
  `payment_date` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_pay_sale` FOREIGN KEY (`sale_id`)
    REFERENCES `sales` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pay_currency` FOREIGN KEY (`currency_code`)
    REFERENCES `currencies` (`code`) ON DELETE RESTRICT,
  CONSTRAINT `fk_pay_user` FOREIGN KEY (`received_by_user_id`)
    REFERENCES `users` (`id`) ON DELETE RESTRICT,
  INDEX `idx_payments_sale` (`sale_id`)
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 7. RETURNS WORKFLOW (SALES & PURCHASES)
-- -----------------------------------------------------------------------------

-- Returns header
CREATE TABLE IF NOT EXISTS `returns` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `return_number` VARCHAR(50) NOT NULL UNIQUE,
  `return_type` ENUM('SALE_RETURN', 'PURCHASE_RETURN') NOT NULL,
  `reference_sale_id` INT UNSIGNED NULL,
  `reference_purchase_order_id` INT UNSIGNED NULL,
  `customer_id` INT UNSIGNED NULL,
  `supplier_id` INT UNSIGNED NULL,
  `return_date` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `total_refund_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `reason` VARCHAR(255) NOT NULL,
  `status` ENUM('pending', 'approved', 'completed', 'rejected') NOT NULL DEFAULT 'completed',
  `processed_by_user_id` INT UNSIGNED NOT NULL,
  `notes` TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_ret_sale` FOREIGN KEY (`reference_sale_id`)
    REFERENCES `sales` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_ret_po` FOREIGN KEY (`reference_purchase_order_id`)
    REFERENCES `purchase_orders` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_ret_customer` FOREIGN KEY (`customer_id`)
    REFERENCES `customers` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_ret_supplier` FOREIGN KEY (`supplier_id`)
    REFERENCES `suppliers` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_ret_user` FOREIGN KEY (`processed_by_user_id`)
    REFERENCES `users` (`id`) ON DELETE RESTRICT,
  INDEX `idx_returns_type` (`return_type`),
  INDEX `idx_returns_date` (`return_date`)
) ENGINE=InnoDB;

-- Return line items
CREATE TABLE IF NOT EXISTS `return_items` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `return_id` INT UNSIGNED NOT NULL,
  `sale_item_id` INT UNSIGNED NULL,
  `batch_id` INT UNSIGNED NOT NULL,
  `medicine_id` INT UNSIGNED NOT NULL,
  `quantity` INT UNSIGNED NOT NULL,
  `unit_refund_price` DECIMAL(12,2) NOT NULL,
  `total_refund` DECIMAL(12,2) NOT NULL,
  `restock_action` ENUM('RESTOCK_ACTIVE', 'QUARANTINE_DAMAGED', 'DISPOSE_EXPIRED') NOT NULL DEFAULT 'RESTOCK_ACTIVE',
  `notes` VARCHAR(255) NULL,
  CONSTRAINT `fk_ri_return` FOREIGN KEY (`return_id`)
    REFERENCES `returns` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ri_sale_item` FOREIGN KEY (`sale_item_id`)
    REFERENCES `sale_items` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_ri_batch` FOREIGN KEY (`batch_id`)
    REFERENCES `batches` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_ri_medicine` FOREIGN KEY (`medicine_id`)
    REFERENCES `medicines` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `chk_ri_quantity` CHECK (`quantity` > 0)
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 8. PHARMACY SYSTEM SETTINGS & CONFIGURATION
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `pharmacy_settings` (
  `setting_key` VARCHAR(100) PRIMARY KEY,
  `setting_value` TEXT NOT NULL,
  `setting_group` ENUM('general', 'finance', 'inventory', 'pos', 'receipt', 'security') NOT NULL DEFAULT 'general',
  `description` VARCHAR(255) NULL,
  `is_editable` BOOLEAN NOT NULL DEFAULT TRUE,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 9. SAFETY VIEWS
-- -----------------------------------------------------------------------------

-- 1. Active Stock ordered by FEFO (First Expired, First Out)
CREATE OR REPLACE VIEW `v_active_stock_fefo` AS
SELECT
  b.id AS batch_id,
  b.batch_number,
  m.id AS medicine_id,
  m.generic_name,
  m.brand_name,
  m.strength,
  m.strength_unit,
  df.name AS dosage_form,
  c.name AS category_name,
  b.quantity_on_hand,
  b.selling_price,
  b.cost_price,
  b.expiry_date,
  DATEDIFF(b.expiry_date, CURRENT_DATE) AS days_until_expiry,
  b.status AS batch_status
FROM `batches` b
JOIN `medicines` m ON b.medicine_id = m.id
JOIN `dosage_forms` df ON m.dosage_form_id = df.id
JOIN `categories` c ON m.category_id = c.id
WHERE b.status = 'active'
  AND b.quantity_on_hand > 0
  AND b.expiry_date > CURRENT_DATE
ORDER BY b.medicine_id ASC, b.expiry_date ASC;

-- 2. Low Stock Alerts
CREATE OR REPLACE VIEW `v_low_stock_alerts` AS
SELECT
  m.id AS medicine_id,
  m.generic_name,
  m.brand_name,
  m.strength,
  m.strength_unit,
  df.name AS dosage_form,
  COALESCE(SUM(b.quantity_on_hand), 0) AS total_stock_on_hand,
  m.reorder_level,
  (m.reorder_level - COALESCE(SUM(b.quantity_on_hand), 0)) AS deficit_quantity
FROM `medicines` m
JOIN `dosage_forms` df ON m.dosage_form_id = df.id
LEFT JOIN `batches` b ON m.id = b.medicine_id AND b.status = 'active' AND b.expiry_date > CURRENT_DATE
WHERE m.status = 'active'
GROUP BY m.id, m.generic_name, m.brand_name, m.strength, m.strength_unit, df.name, m.reorder_level
HAVING total_stock_on_hand <= m.reorder_level;

-- 3. Near Expiry Batches (within configured 90 days default)
CREATE OR REPLACE VIEW `v_near_expiry_batches` AS
SELECT
  b.id AS batch_id,
  b.batch_number,
  m.generic_name,
  m.brand_name,
  m.strength,
  b.quantity_on_hand,
  b.expiry_date,
  DATEDIFF(b.expiry_date, CURRENT_DATE) AS days_until_expiry,
  b.status AS batch_status
FROM `batches` b
JOIN `medicines` m ON b.medicine_id = m.id
WHERE b.status = 'active'
  AND b.quantity_on_hand > 0
  AND b.expiry_date > CURRENT_DATE
  AND DATEDIFF(b.expiry_date, CURRENT_DATE) <= 90
ORDER BY b.expiry_date ASC;

-- -----------------------------------------------------------------------------
-- 10. PHARMACY SAFETY TRIGGERS
-- -----------------------------------------------------------------------------

DELIMITER $$

-- Trigger 1: Intercept sale item insertions to guarantee safety rules
CREATE TRIGGER `trg_prevent_blocked_batch_sale`
BEFORE INSERT ON `sale_items`
FOR EACH ROW
BEGIN
  DECLARE v_batch_status VARCHAR(20);
  DECLARE v_batch_qty INT UNSIGNED;
  DECLARE v_expiry_date DATE;

  -- Query batch status and current on-hand quantity
  SELECT `status`, `quantity_on_hand`, `expiry_date`
    INTO v_batch_status, v_batch_qty, v_expiry_date
    FROM `batches`
   WHERE `id` = NEW.batch_id;

  -- Safety Rule 1: Cannot dispense non-active batches
  IF v_batch_status != 'active' THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'PHARMACY SAFETY ERROR: Cannot dispense an inactive, expired, recalled, or quarantined batch.';
  END IF;

  -- Safety Rule 2: Cannot dispense expired stock
  IF v_expiry_date <= CURRENT_DATE THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'PHARMACY SAFETY ERROR: Cannot dispense expired stock. Batch expiry date has passed.';
  END IF;

  -- Safety Rule 3: Cannot oversell
  IF NEW.quantity > v_batch_qty THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'PHARMACY SAFETY ERROR: Insufficient stock on hand in the selected batch.';
  END IF;
END$$

-- Trigger 2: Atomically deduct stock and record stock movement on sale
CREATE TRIGGER `trg_deduct_stock_on_sale`
AFTER INSERT ON `sale_items`
FOR EACH ROW
BEGIN
  DECLARE v_old_qty INT UNSIGNED;
  DECLARE v_new_qty INT UNSIGNED;
  DECLARE v_invoice_no VARCHAR(50);

  SELECT `quantity_on_hand` INTO v_old_qty
    FROM `batches` WHERE `id` = NEW.batch_id;

  SET v_new_qty = v_old_qty - NEW.quantity;

  -- Update batch on-hand quantity
  UPDATE `batches`
     SET `quantity_on_hand` = v_new_qty,
         `status` = CASE WHEN v_new_qty = 0 THEN 'exhausted' ELSE `status` END
   WHERE `id` = NEW.batch_id;

  -- Fetch invoice number for the movement log
  SELECT `invoice_number` INTO v_invoice_no
    FROM `sales` WHERE `id` = NEW.sale_id;

  -- Log stock movement
  INSERT INTO `stock_movements` (
    `batch_id`,
    `movement_type`,
    `quantity_change`,
    `previous_quantity`,
    `new_quantity`,
    `reference_type`,
    `reference_id`,
    `reason`
  ) VALUES (
    NEW.batch_id,
    'SALE_DISPENSE',
    -NEW.quantity,
    v_old_qty,
    v_new_qty,
    'sale',
    v_invoice_no,
    'POS Dispense'
  );
END$$

DELIMITER ;

-- =============================================================================
-- End of Schema Definition
-- =============================================================================
