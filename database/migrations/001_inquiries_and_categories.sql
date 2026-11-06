-- =============================================================================
-- PharmaCare Migration 001: Doctor Inquiries, Email Logs, and Expanded Categories
-- Non-destructive: Safe to run on existing pharmacare_db
-- =============================================================================

USE `pharmacare_db`;

-- 1. Expanded Categories from Phase Requirements
INSERT INTO `categories` (`name`, `description`) VALUES
('Tablets & Capsules', 'Oral solid dosage forms including conventional and sustained-release'),
('Syrups & Suspensions', 'Oral liquids, pediatric syrups, and dry powder suspensions'),
('Injections & Vials', 'Parenteral preparations, IV infusions, ampoules, and lyophilized vials'),
('Eye, Ear & Nasal Drops', 'Sterile ophthalmic, otic, and nasal solutions and suspensions'),
('Creams, Ointments, Gels & Lotions', 'Topical dermatological preparations and transdermal agents'),
('Inhalers, Sprays & Nebulizers', 'Aerosolized inhalers, DPIs, nasal sprays, and nebulizer solutions'),
('Allergy & Antihistamines', 'Antihistamines, mast cell stabilizers, and anti-allergy agents'),
('Pain Relief & Fever Medicines', 'Analgesics, NSAIDs, antipyretics, and pain management'),
('Vitamins & Supplements', 'Multivitamins, mineral supplements, and nutraceuticals'),
('Diabetes & Blood Pressure', 'Oral hypoglycemics, insulin, ACE inhibitors, ARBs, and CCBs'),
('First-Aid & Medical Supplies', 'Antiseptics, burn treatments, first-aid kits, and emergency supplies'),
('Bandages, Dressings & Consumables', 'Sterile gauze, adhesive bandages, surgical tape, and consumables'),
('Baby-Care & Personal-Care Products', 'Pediatric care, infant nutrition, sanitizers, and hygiene items'),
('Other Locally Stocked Products', 'Miscellaneous and general pharmacy shelf inventory')
ON DUPLICATE KEY UPDATE `description` = VALUES(`description`);

-- 2. Expanded Dosage Forms
INSERT INTO `dosage_forms` (`name`, `description`) VALUES
('Lotion', 'Fluid suspension or emulsion applied externally'),
('Spray', 'Liquid dispersed in coarse drops or pressurized mist'),
('Nebulizer Solution', 'Sterile aqueous solution for aerosol inhalation'),
('Bandage', 'Strip of fabric used to bind wounds or dressings'),
('Dressing', 'Sterile covering applied directly to wounds')
ON DUPLICATE KEY UPDATE `description` = VALUES(`description`);

-- 3. Doctor Medicine Photo Inquiries Table
CREATE TABLE IF NOT EXISTS `doctor_inquiries` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `reference_no` VARCHAR(50) NOT NULL,
  `doctor_name` VARCHAR(150) NOT NULL,
  `clinic_hospital_name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `phone` VARCHAR(50) DEFAULT NULL,
  `manual_notes` TEXT DEFAULT NULL,
  `image_filename` VARCHAR(255) DEFAULT NULL,
  `image_original_name` VARCHAR(255) DEFAULT NULL,
  `image_mime_type` VARCHAR(100) DEFAULT NULL,
  `image_size_bytes` INT UNSIGNED DEFAULT NULL,
  `status` ENUM('pending', 'in_review', 'responded', 'closed') NOT NULL DEFAULT 'pending',
  `reviewed_by_user_id` INT UNSIGNED DEFAULT NULL,
  `staff_response_notes` TEXT DEFAULT NULL,
  `email_status` ENUM('pending', 'sent', 'failed') NOT NULL DEFAULT 'pending',
  `email_error` TEXT DEFAULT NULL,
  `email_sent_at` DATETIME DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_inquiry_ref` (`reference_no`),
  KEY `idx_inquiry_status` (`status`),
  KEY `idx_inquiry_email` (`email`),
  KEY `idx_inquiry_created` (`created_at`),
  CONSTRAINT `fk_inquiry_reviewer` FOREIGN KEY (`reviewed_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Inquiry Line Items (Medicines identified & verified by staff)
CREATE TABLE IF NOT EXISTS `doctor_inquiry_items` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `inquiry_id` INT UNSIGNED NOT NULL,
  `item_name_raw` VARCHAR(255) NOT NULL,
  `matched_medicine_id` INT UNSIGNED DEFAULT NULL,
  `availability_status` ENUM('available', 'partially_available', 'out_of_stock', 'needs_clarification') NOT NULL DEFAULT 'needs_clarification',
  `available_quantity` INT UNSIGNED NOT NULL DEFAULT 0,
  `unit_price` DECIMAL(12,2) DEFAULT NULL,
  `notes` VARCHAR(255) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_item_inquiry` (`inquiry_id`),
  KEY `idx_item_medicine` (`matched_medicine_id`),
  CONSTRAINT `fk_inq_item_inquiry` FOREIGN KEY (`inquiry_id`) REFERENCES `doctor_inquiries` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_inq_item_medicine` FOREIGN KEY (`matched_medicine_id`) REFERENCES `medicines` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Email Communication Logs (Tracks all outgoing notifications & responses)
CREATE TABLE IF NOT EXISTS `email_logs` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `inquiry_id` INT UNSIGNED DEFAULT NULL,
  `recipient_email` VARCHAR(255) NOT NULL,
  `subject` VARCHAR(255) NOT NULL,
  `body_text` TEXT NOT NULL,
  `status` ENUM('sent', 'failed') NOT NULL,
  `error_message` TEXT DEFAULT NULL,
  `attempt_count` INT UNSIGNED NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_email_inquiry` (`inquiry_id`),
  KEY `idx_email_status` (`status`),
  CONSTRAINT `fk_email_inquiry` FOREIGN KEY (`inquiry_id`) REFERENCES `doctor_inquiries` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Add Permissions for Doctor Inquiries
INSERT IGNORE INTO `permissions` (`code`, `module`, `description`) VALUES
('inquiries:view', 'inquiries', 'View public doctor medicine availability inquiries'),
('inquiries:respond', 'inquiries', 'Inspect prescription images, match stock and email responses');

-- Map to Admin (role 1) and Pharmacist (role 2)
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT 1, `id` FROM `permissions` WHERE `code` IN ('inquiries:view', 'inquiries:respond');

INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT 2, `id` FROM `permissions` WHERE `code` IN ('inquiries:view', 'inquiries:respond');
