-- =============================================================================
-- PharmaCare Pharmacy Management System
-- Development & Testing Seed Data: pharmacare_db
-- ⚠ NOTICE: This file contains FICTIONAL DEMONSTRATION DATA ONLY.
-- None of these records represent real patient medical histories, actual clinical
-- registrations, or certified pharmaceutical inventories.
-- =============================================================================

USE `pharmacare_db`;

-- Disable foreign key checks during batch seeding
SET FOREIGN_KEY_CHECKS = 0;

-- -----------------------------------------------------------------------------
-- 1. SEED: ROLES
-- -----------------------------------------------------------------------------
TRUNCATE TABLE `role_permissions`;
TRUNCATE TABLE `roles`;

INSERT INTO `roles` (`id`, `name`, `display_name`, `description`, `is_system_role`) VALUES
(1, 'admin',         'System Administrator', 'Full administrative control over users, settings, and audits', TRUE),
(2, 'pharmacist',    'Licensed Pharmacist',  'Authorized to dispense, verify prescriptions, and manage clinical inventory', TRUE),
(3, 'stock_manager', 'Inventory Manager',    'Manages suppliers, purchase orders, deliveries, and stock transfers', TRUE),
(4, 'cashier',       'POS Cashier',          'Point of Sale billing, payment receipts, and customer checkout', TRUE);

-- -----------------------------------------------------------------------------
-- 2. SEED: PERMISSIONS
-- -----------------------------------------------------------------------------
TRUNCATE TABLE `permissions`;

INSERT INTO `permissions` (`id`, `code`, `module`, `description`) VALUES
(1,  'dashboard:view',      'dashboard',    'View dashboard metrics and analytics'),
(2,  'medicines:view',      'medicines',    'View medicine catalogue'),
(3,  'medicines:create',    'medicines',    'Create new medicine entries'),
(4,  'medicines:edit',      'medicines',    'Edit existing medicines and packaging'),
(5,  'medicines:delete',    'medicines',    'Discontinue or soft-delete medicines'),
(6,  'inventory:view',      'inventory',    'View stock batches and movements'),
(7,  'inventory:adjust',    'inventory',    'Perform stock adjustments and write-offs'),
(8,  'inventory:quarantine','inventory',    'Quarantine or recall stock batches'),
(9,  'pos:access',          'pos',          'Access Point of Sale billing terminal'),
(10, 'pos:dispense',        'pos',          'Dispense medicines and finalize sales'),
(11, 'pos:apply_discount',  'pos',          'Apply manual discounts to sale invoices'),
(12, 'returns:process',     'returns',      'Process customer and supplier returns'),
(13, 'prescriptions:view',  'prescriptions','View restricted prescription records'),
(14, 'prescriptions:verify','prescriptions','Verify and approve medical prescriptions'),
(15, 'purchases:view',      'purchases',    'View purchase orders and supplier invoices'),
(16, 'purchases:create',    'purchases',    'Create and receive purchase orders'),
(17, 'suppliers:manage',    'suppliers',    'Manage supplier directory and terms'),
(18, 'reports:view',        'reports',      'View sales, financial, and stock valuation reports'),
(19, 'users:manage',        'users',        'Create and manage staff accounts and roles'),
(20, 'settings:edit',       'settings',     'Update pharmacy configuration and tax rules');

-- Map Role Permissions
-- Admin: All permissions (1..20)
INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT 1, `id` FROM `permissions`;

-- Pharmacist: Clinical, dispensing, inventory, rx, returns, reports
INSERT INTO `role_permissions` (`role_id`, `permission_id`) VALUES
(2, 1), (2, 2), (2, 3), (2, 4), (2, 6), (2, 8), (2, 9), (2, 10),
(2, 11), (2, 12), (2, 13), (2, 14), (2, 15), (2, 18);

-- Stock Manager: Inventory, purchasing, suppliers, reports
INSERT INTO `role_permissions` (`role_id`, `permission_id`) VALUES
(3, 1), (3, 2), (3, 6), (3, 7), (3, 8), (3, 15), (3, 16), (3, 17), (3, 18);

-- Cashier: POS, customer sales view, basic catalogue read
INSERT INTO `role_permissions` (`role_id`, `permission_id`) VALUES
(4, 1), (4, 2), (4, 9), (4, 10);

-- -----------------------------------------------------------------------------
-- 3. SEED: USERS (Fictional Demo Accounts)
-- Default password for all demo accounts: 'Password123!'
-- Hash generated using bcrypt (12 rounds)
-- -----------------------------------------------------------------------------
TRUNCATE TABLE `users`;

INSERT INTO `users` (`id`, `role_id`, `username`, `email`, `password_hash`, `full_name`, `phone`, `status`) VALUES
(1, 1, 'admin',  'admin@pharmacare.pk',  '$2a$12$qfsDq5iakgQjzzo1hPaveOxaunV1uk6R8A0D8sxxjFLcZ3DO2oT7C', 'Administrator',    '0300-1111111', 'active'),
(2, 2, 'ahmed',  'ahmed@pharmacare.pk',  '$2a$12$qfsDq5iakgQjzzo1hPaveOxaunV1uk6R8A0D8sxxjFLcZ3DO2oT7C', 'Dr. Ahmed Ali (R.Ph)','0300-2222222', 'active'),
(3, 4, 'sara',   'sara@pharmacare.pk',   '$2a$12$qfsDq5iakgQjzzo1hPaveOxaunV1uk6R8A0D8sxxjFLcZ3DO2oT7C', 'Sara Malik',       '0300-3333333', 'active'),
(4, 3, 'kamran', 'kamran@pharmacare.pk', '$2a$12$qfsDq5iakgQjzzo1hPaveOxaunV1uk6R8A0D8sxxjFLcZ3DO2oT7C', 'Kamran Raza',     '0300-4444444', 'active'),
(5, 4, 'nadia',  'nadia@pharmacare.pk',  '$2a$12$qfsDq5iakgQjzzo1hPaveOxaunV1uk6R8A0D8sxxjFLcZ3DO2oT7C', 'Nadia Bibi',       '0300-5555555', 'inactive');

-- -----------------------------------------------------------------------------
-- 4. SEED: REFERENCE DATA (Categories, Dosage Forms, Manufacturers)
-- -----------------------------------------------------------------------------
TRUNCATE TABLE `categories`;
INSERT INTO `categories` (`id`, `name`, `description`) VALUES
(1,  'Analgesics & Antipyretics', 'Pain and fever relief medications'),
(2,  'Antibiotics & Antimicrobials', 'Bacterial infection treatment'),
(3,  'Antidiabetics', 'Blood sugar regulation'),
(4,  'Antacids & PPIs', 'Acid reflux and peptic ulcer treatment'),
(5,  'Bronchodilators & Respiratory', 'Asthma and respiratory management'),
(6,  'Oral Rehydration Therapy', 'Electrolyte and fluid replenishment'),
(7,  'Ophthalmic & ENT Preparations', 'Eye, ear, and nasal topical treatments'),
(8,  'Cardiovascular & Antihypertensives', 'Heart disease and blood pressure regulation'),
(9,  'Dermatological Preparations', 'Skin creams, ointments, and emollients'),
(10, 'Vitamins & Minerals', 'Nutritional and dietary supplements');

TRUNCATE TABLE `dosage_forms`;
INSERT INTO `dosage_forms` (`id`, `name`, `description`) VALUES
(1,  'Tablet',         'Solid compressed oral unit'),
(2,  'Capsule',        'Gelatin-encapsulated powder or liquid'),
(3,  'Syrup',          'Concentrated sweetened oral liquid'),
(4,  'Suspension',     'Liquid containing insoluble drug particles'),
(5,  'Injection',      'Sterile solution for parenteral injection'),
(6,  'Ampoule',        'Sealed single-dose glass injection container'),
(7,  'Vial',           'Multi-dose rubber-stoppered injection container'),
(8,  'Eye Drop',       'Sterile ophthalmic topical solution'),
(9,  'Ear Drop',       'Otic topical solution'),
(10, 'Nasal Drop',      'Nasal decongestant or therapeutic drop'),
(11, 'Cream',          'Semisolid emulsion for topical dermatological application'),
(12, 'Ointment',       'Oil-based topical protective application'),
(13, 'Gel',            'Semisolid aqueous formulation'),
(14, 'Inhaler',        'Metered-dose aerosol inhaler for lungs'),
(15, 'Powder',         'Dry bulk or divided powder'),
(16, 'Sachet',         'Single-dose sealed dry packet'),
(17, 'Suppository',    'Rectal solid unit designed to melt at body temperature'),
(18, 'Medical Device', 'Non-pharmacological medical supplies (syringes, strips, monitors)'),
(19, 'Other',          'Configurable generic dosage form');

TRUNCATE TABLE `manufacturers`;
INSERT INTO `manufacturers` (`id`, `name`, `country`, `contact_person`, `phone`, `email`, `license_number`) VALUES
(1, 'GSK Pakistan Ltd',           'Pakistan', 'Hamza Tariq',  '021-111475725', 'info.pk@gsk.com',      'DRAP-MFG-001'),
(2, 'Abbott Laboratories (Pak)',   'Pakistan', 'Zainab Qazi',  '021-35069746',  'support@abbott.com.pk','DRAP-MFG-002'),
(3, 'Merck Private Limited',       'Pakistan', 'Bilal Sheikh', '021-35688531',  'pkinfo@merck.com',     'DRAP-MFG-003'),
(4, 'Pfizer Pakistan Limited',     'Pakistan', 'Farhan Khan',  '021-32412801',  'pk.support@pfizer.com','DRAP-MFG-004'),
(5, 'Sanofi-Aventis Pakistan Ltd', 'Pakistan', 'Mariam Aslam', '021-35060221',  'info@sanofi.com.pk',   'DRAP-MFG-005'),
(6, 'Reckitt Benckiser Pakistan',  'Pakistan', 'Daniyal Mir',  '021-35060371',  'info@reckitt.pk',      'DRAP-MFG-006');

-- -----------------------------------------------------------------------------
-- 5. SEED: CURRENCIES & TAX RULES
-- -----------------------------------------------------------------------------
TRUNCATE TABLE `currencies`;
INSERT INTO `currencies` (`code`, `name`, `symbol`, `locale`, `exchange_rate`, `is_base`, `is_active`) VALUES
('PKR', 'Pakistani Rupee',  '₨', 'ur-PK', 1.000000,   TRUE,  TRUE),
('USD', 'US Dollar',        '$', 'en-US', 278.500000, FALSE, TRUE),
('EUR', 'Euro',             '€', 'en-DE', 302.200000, FALSE, TRUE),
('GBP', 'Pound Sterling',   '£', 'en-GB', 362.800000, FALSE, TRUE);

TRUNCATE TABLE `tax_rules`;
INSERT INTO `tax_rules` (`id`, `name`, `code`, `rate_percent`, `description`, `is_default`, `is_active`) VALUES
(1, 'Zero-Rated / Exempt Life Saving', 'EXEMPT', 0.00, 'Essential & life-saving medicines exempt from GST', TRUE, TRUE),
(2, 'Standard GST (Healthcare)',       'GST_STD',18.00,'Standard sales tax on taxable healthcare products', FALSE, TRUE),
(3, 'Reduced Medical Devices GST',     'GST_DEV',10.00,'Concessional sales tax on therapeutic diagnostic devices', FALSE, TRUE);

-- -----------------------------------------------------------------------------
-- 6. SEED: SUPPLIERS & CUSTOMERS
-- -----------------------------------------------------------------------------
TRUNCATE TABLE `suppliers`;
INSERT INTO `suppliers` (`id`, `name`, `contact_person`, `phone`, `email`, `city`, `tax_ntn_number`, `drug_sale_license`, `payment_terms`, `status`) VALUES
(1, 'MedPlus Distributors',    'Tariq Mehmood', '0300-1234567', 'sales@medplus.pk',   'Karachi',   'NTN-9842101', 'DRAP-DSL-KHI-401', 'Net 30', 'active'),
(2, 'Al-Shifa Pharma Agency',   'Bilal Hussain', '0321-9876543', 'orders@alshifa.pk',  'Lahore',    'NTN-4512984', 'DRAP-DSL-LHR-210', 'Net 15', 'active'),
(3, 'Noor Medical Supplies',   'Ayesha Siddiq', '0333-4567890', 'info@noormed.pk',    'Islamabad', 'NTN-7812034', 'DRAP-DSL-ISB-108', 'Net 30', 'active'),
(4, 'Hamdard Pharmaceutical Dist','Usman Khan', '0345-6789012', 'usman@hamdarddist.pk','Karachi',  'NTN-1290485', 'DRAP-DSL-KHI-712', 'Cash',   'active'),
(5, 'Fazal Pharma Linkers',    'Zara Tahir',    '0311-2345678', 'zara@fazalpharma.pk','Peshawar',  'NTN-6671239', 'DRAP-DSL-PEW-093', 'Net 45', 'inactive');

TRUNCATE TABLE `customers`;
INSERT INTO `customers` (`id`, `name`, `phone`, `email`, `address`, `cnic_or_id`, `is_tax_exempt`) VALUES
(1, 'Walk-in Patient', NULL,           NULL,                  'Karachi', NULL,                FALSE),
(2, 'Fatima Khan',     '0300-9876543', 'fatima.k@example.com','Karachi', '42101-1234567-1',  FALSE),
(3, 'Muhammad Raza',   '0321-1239874', 'm.raza@example.com',  'Karachi', '42201-9876543-2',  FALSE),
(4, 'Aisha Bibi',      '0333-8765432', 'aisha.b@example.com', 'Lahore',  '35202-3456789-4',  FALSE);

-- -----------------------------------------------------------------------------
-- 7. SEED: MEDICINES CATALOGUE & PACKAGES
-- -----------------------------------------------------------------------------
TRUNCATE TABLE `medicines`;
INSERT INTO `medicines` (
  `id`, `generic_name`, `brand_name`, `category_id`, `dosage_form_id`,
  `manufacturer_id`, `strength`, `strength_unit`, `barcode`, `requires_prescription`,
  `tax_rule_id`, `reorder_level`, `status`
) VALUES
(1,  'Paracetamol',      'Panadol',       1, 1,  1, '500',   'mg',     '8901234567890', FALSE, 1, 200, 'active'),
(2,  'Amoxicillin',       'Amoxil',        2, 2,  2, '500',   'mg',     '8901234567891', TRUE,  1, 100, 'active'),
(3,  'Amoxicillin',       'Amoxil',        2, 2,  2, '250',   'mg',     '8901234567892', TRUE,  1, 100, 'active'),
(4,  'Metformin HCl',    'Glucophage',    3, 1,  3, '500',   'mg',     '8901234567893', TRUE,  1, 150, 'active'),
(5,  'Omeprazole',        'Omez',          4, 2,  1, '20',    'mg',     '8901234567894', FALSE, 1, 80,  'active'),
(6,  'Salbutamol',        'Ventolin',      5, 14, 1, '100',   'mcg',    '8901234567895', TRUE,  1, 30,  'active'),
(7,  'Cefixime',          'Suprax',        2, 2,  4, '200',   'mg',     '8901234567896', TRUE,  1, 50,  'active'),
(8,  'Oral Rehydration Salt', 'Pedialyte', 6, 16, 2, 'Standard','Sachet','8901234567897', FALSE, 1, 150, 'active'),
(9,  'Insulin Glargine',  'Lantus',        3, 5,  5, '100',   'IU/ml',  '8901234567898', TRUE,  1, 20,  'active'),
(10, 'Azithromycin',      'Zithromax',     2, 3,  4, '200',   'mg/5ml', '8901234567899', TRUE,  1, 40,  'active'),
(11, 'Aspirin',           'Disprin',       1, 1,  6, '75',    'mg',     '8901234567900', FALSE, 1, 100, 'active'),
(12, 'Chloramphenicol',   'Chloromycetin', 7, 8,  4, '0.5',   '%',      '8901234567901', TRUE,  1, 25,  'discontinued');

TRUNCATE TABLE `medicine_packages`;
INSERT INTO `medicine_packages` (`id`, `medicine_id`, `package_label`, `units_per_package`, `is_default_sale_unit`) VALUES
(1, 1, 'Strip of 10 Tablets',   10,  TRUE),
(2, 1, 'Box of 20 Strips (200)',200, FALSE),
(3, 2, 'Strip of 12 Capsules',  12,  TRUE),
(4, 2, 'Box of 10 Strips (120)',120, FALSE),
(5, 6, 'Metered Inhaler 200 Doses', 1, TRUE),
(6, 8, 'Single Sachet',         1,   TRUE);

-- -----------------------------------------------------------------------------
-- 8. SEED: BATCHES & STOCK
-- Including near-expiry, expired, and recalled batches for rigorous QA verification
-- -----------------------------------------------------------------------------
TRUNCATE TABLE `batches`;
INSERT INTO `batches` (
  `id`, `batch_number`, `medicine_id`, `supplier_id`, `manufacturing_date`,
  `expiry_date`, `initial_quantity`, `quantity_on_hand`, `cost_price`,
  `selling_price`, `status`, `quarantine_reason`
) VALUES
-- Active batches
(1, 'PAN-2024-001', 1, 1, '2024-01-10', '2026-08-31', 1000, 850, 12.00,  18.00,  'active', NULL),
(2, 'PAN-2024-008', 1, 1, '2024-08-01', '2026-12-31', 800,  650, 13.00,  18.00,  'active', NULL),
(3, 'AMX-2024-003', 2, 2, '2024-03-15', '2026-09-30', 200,  45,  220.00, 300.00, 'active', NULL),
(4, 'LNT-2024-002', 9, 3, '2024-02-01', '2026-06-30', 20,   8,   1800.00,2400.00,'active', NULL),
(5, 'CFX-2024-03',  7, 4, '2024-01-20', '2026-11-30', 150,  120, 185.00, 250.00, 'active', NULL),
(6, 'GLU-2024-05',  4, 2, '2024-05-10', '2027-04-30', 800,  600, 18.00,  26.00,  'active', NULL),
(7, 'OMZ-2024-01',  5, 1, '2024-01-05', '2026-10-31', 400,  320, 25.00,  35.00,  'active', NULL),
(8, 'VEN-2024-02',  6, 1, '2024-02-15', '2026-05-31', 50,   12,  380.00, 480.00, 'active', NULL),
(9, 'PED-2024-09',  8, 2, '2024-09-01', '2027-08-31', 500,  400, 15.00,  22.00,  'active', NULL),

-- Near-Expiry Batch (Within 90 days from Oct 2026: Expiring Nov 2026)
(10, 'AZI-2024-07', 10, 4, '2024-07-01', '2026-11-15', 100, 48, 160.00, 220.00, 'active', NULL),

-- Expired Batch (Passed expiry date - system MUST block from POS sale)
(11, 'GRM-2023-12', 3, 2, '2023-12-01', '2024-09-30', 100, 0,  120.00, 180.00, 'expired', 'Expired past shelf life'),

-- Recalled Batch (Manufacturer recall safety alert - system MUST block from POS sale)
(12, 'CLR-2024-05', 12, 4, '2024-05-01', '2026-12-31', 60,  60, 320.00, 450.00, 'recalled', 'DRAP Safety Recall Alert #2024-18');

-- -----------------------------------------------------------------------------
-- 9. SEED: INITIAL STOCK MOVEMENTS (Auditing the received batches)
-- -----------------------------------------------------------------------------
TRUNCATE TABLE `stock_movements`;
INSERT INTO `stock_movements` (
  `batch_id`, `movement_type`, `quantity_change`, `previous_quantity`,
  `new_quantity`, `reference_type`, `reference_id`, `reason`, `performed_by_user_id`
) VALUES
(1,  'PURCHASE_RECEIPT', 1000, 0, 1000, 'purchase_order', 'PO-2024-001', 'Opening Initial Stock', 4),
(2,  'PURCHASE_RECEIPT', 800,  0, 800,  'purchase_order', 'PO-2024-010', 'Opening Initial Stock', 4),
(3,  'PURCHASE_RECEIPT', 200,  0, 200,  'purchase_order', 'PO-2024-014', 'Opening Initial Stock', 4),
(4,  'PURCHASE_RECEIPT', 20,   0, 20,   'purchase_order', 'PO-2024-018', 'Opening Initial Stock', 4),
(12, 'AUDIT_ADJUSTMENT', 0,    60, 60,  'recall_notice',  'REC-2024-01',  'Quarantined per DRAP recall notice', 2);

-- -----------------------------------------------------------------------------
-- 10. SEED: SYSTEM SETTINGS (Matching Phase 2 Settings Configuration)
-- -----------------------------------------------------------------------------
TRUNCATE TABLE `pharmacy_settings`;
INSERT INTO `pharmacy_settings` (`setting_key`, `setting_value`, `setting_group`, `description`, `is_editable`) VALUES
('pharmacy_name',         'PharmaCare Pharmacy',             'general',   'Official pharmacy trading name', TRUE),
('pharmacy_address',      'Plot 42-B, Commercial Area, Karachi, Pakistan', 'general', 'Physical street address', TRUE),
('pharmacy_phone',        '+92-21-34567890',                 'general',   'Customer helpline / contact telephone', TRUE),
('pharmacy_drap_license', 'DRAP-LIC-KHI-2024-9812',          'general',   'Drug Regulatory Authority retail license', TRUE),
('currency_code',         'PKR',                             'finance',   'Default active operating currency', TRUE),
('currency_symbol',       '₨',                              'finance',   'Operating currency glyph symbol', TRUE),
('currency_locale',       'ur-PK',                           'finance',   'Number and monetary localization string', TRUE),
('tax_enabled',           'false',                           'finance',   'Global tax calculation toggle (true/false)', TRUE),
('tax_label',             'GST',                             'finance',   'Display tax label on customer receipts', TRUE),
('tax_default_rate',      '0.00',                            'finance',   'Fallback tax rate percentage', TRUE),
('receipt_default_type',  'pdf',                             'receipt',   'Default receipt printer format (pdf / thermal)', TRUE),
('receipt_show_tax',      'true',                            'receipt',   'Display itemized tax breakdown on receipts', TRUE),
('receipt_footer_note',   'Thank you for your visit. Keep all medicines out of reach of children.', 'receipt', 'Standard receipt footer note', TRUE),
('near_expiry_days',      '90',                              'inventory', 'Threshold in days to flag near-expiry inventory', TRUE),
('low_stock_default',     '50',                              'inventory', 'Fallback minimum stock reorder alert quantity', TRUE),
('prescription_enforce',  'true',                            'security',  'Require verification confirmation for Rx-only items', TRUE);

-- Re-enable foreign key constraints
SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================================
-- End of Seed Data
-- =============================================================================
