import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const targetHost = process.env.DB_HOST || '';
const targetDb = process.env.DB_NAME || '';

if (!targetHost.includes('tidbcloud.com')) {
  console.error('[ABORT] Target host is not TiDB Cloud! Host:', targetHost);
  process.exit(1);
}

if (targetDb !== 'pharmacare') {
  console.error('[ABORT] Target DB is not pharmacare! DB:', targetDb);
  process.exit(1);
}

function buildSslConfig() {
  const caPath = process.env.DB_CA_PATH || 'certs/isrgrootx1.pem';
  const resolvedCaPath = path.isAbsolute(caPath) ? caPath : path.resolve(process.cwd(), caPath);
  if (fs.existsSync(resolvedCaPath)) {
    return { ca: fs.readFileSync(resolvedCaPath), minVersion: 'TLSv1.2', rejectUnauthorized: true };
  }
  return false;
}

async function run() {
  console.log('='.repeat(70));
  console.log('  PharmaCare — Schema Expansion & Reference Seed Migration (v2)');
  console.log('='.repeat(70));
  console.log(`[Safety Check] Target Host:     ${targetHost}`);
  console.log(`[Safety Check] Target Database: ${targetDb}`);

  const sslConfig = buildSslConfig();
  const conn = await mysql.createConnection({
    host: targetHost,
    port: parseInt(process.env.DB_PORT || '4000', 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: targetDb,
    ssl: sslConfig,
  });

  try {
    console.log('\n[1/10] Ensuring New Tables exist...');

    // 1. Departments table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS departments (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        code VARCHAR(20) NOT NULL UNIQUE,
        description VARCHAR(255),
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 2. Doctors table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS doctors (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        full_name VARCHAR(150) NOT NULL,
        pmdc_number VARCHAR(100) NOT NULL,
        specialization VARCHAR(150) NOT NULL,
        department_id INT UNSIGNED NULL,
        clinic_or_hospital VARCHAR(200),
        phone VARCHAR(50),
        email VARCHAR(100),
        address VARCHAR(255),
        availability VARCHAR(255),
        profile_photo_url VARCHAR(255),
        status ENUM('active','inactive') NOT NULL DEFAULT 'active',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at DATETIME NULL,
        INDEX idx_doc_dept (department_id),
        INDEX idx_doc_pmdc (pmdc_number),
        INDEX idx_doc_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 3. Patients table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS patients (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        mrn VARCHAR(50) NOT NULL UNIQUE,
        full_name VARCHAR(150) NOT NULL,
        age INT UNSIGNED NULL,
        date_of_birth DATE NULL,
        gender ENUM('male','female','other') NOT NULL DEFAULT 'male',
        phone VARCHAR(50),
        email VARCHAR(100),
        address TEXT,
        emergency_contact_name VARCHAR(150),
        emergency_contact_phone VARCHAR(50),
        blood_group VARCHAR(10),
        allergies TEXT,
        medical_notes TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at DATETIME NULL,
        INDEX idx_pat_mrn (mrn),
        INDEX idx_pat_phone (phone)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 4. Expenses table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS expenses (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        category ENUM('Rent','Utilities','Salaries','Maintenance','Marketing','Supplies','Taxes','Logistics','Miscellaneous') NOT NULL DEFAULT 'Miscellaneous',
        amount DECIMAL(12,2) NOT NULL,
        expense_date DATE NOT NULL,
        payment_method ENUM('cash','card','bank_transfer','cheque','mobile_wallet','other') NOT NULL DEFAULT 'cash',
        reference_no VARCHAR(100),
        description TEXT,
        receipt_url VARCHAR(255),
        created_by_user_id INT UNSIGNED NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at DATETIME NULL,
        INDEX idx_exp_date (expense_date),
        INDEX idx_exp_cat (category)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 5. Notifications table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NULL,
        type ENUM('low_stock','near_expiry','expired_batch','new_prescription','inquiry','purchase_received','system') NOT NULL DEFAULT 'system',
        title VARCHAR(200) NOT NULL,
        message TEXT NOT NULL,
        link VARCHAR(255),
        is_read TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_notif_user (user_id),
        INDEX idx_notif_read (is_read),
        INDEX idx_notif_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('  - All new tables checked: OK');

    // 6. Seed 20 Medical Departments
    console.log('\n[2/10] Seeding 20 Medical Departments...');
    const departments = [
      ['Cardiology', 'CARD', 'Diagnosis and treatment of heart and vascular disorders'],
      ['Dermatology', 'DERM', 'Skin, hair, nail conditions and cosmetic dermatology'],
      ['Endocrinology', 'ENDO', 'Hormonal, metabolic and diabetic disorders'],
      ['Gastroenterology', 'GASTRO', 'Digestive tract, liver, and pancreatic disorders'],
      ['General Medicine', 'GENMED', 'Primary healthcare, internal medicine and chronic care'],
      ['General Surgery', 'GENSURG', 'Surgical interventions and post-operative recovery'],
      ['Gynecology & Obstetrics', 'GYN', 'Female reproductive health, prenatal and postnatal care'],
      ['Nephrology', 'NEPH', 'Kidney function, dialysis, and renal disease management'],
      ['Neurology', 'NEURO', 'Brain, spinal cord, and peripheral nervous system care'],
      ['Oncology', 'ONCO', 'Cancer diagnosis, chemotherapy, and supportive oncology'],
      ['Ophthalmology', 'OPHTH', 'Vision care, ocular surgery, and eye diseases'],
      ['Orthopedics', 'ORTHO', 'Bones, joints, ligaments, tendons, and fractures'],
      ['Otorhinolaryngology (ENT)', 'ENT', 'Ear, nose, throat, head and neck conditions'],
      ['Pediatrics', 'PED', 'Child health, neonatal care, and immunization'],
      ['Psychiatry', 'PSYCH', 'Mental health, behavioral disorders, and psychopharmacology'],
      ['Pulmonology', 'PULM', 'Lungs, respiratory tract, asthma, and COPD management'],
      ['Rheumatology', 'RHEUM', 'Autoimmune and musculoskeletal inflammatory disorders'],
      ['Urology', 'UROL', 'Urinary tract and male reproductive system medicine'],
      ['Emergency Medicine', 'EMERG', 'Acute critical care, triage, and trauma resuscitation'],
      ['Anesthesiology', 'ANESTH', 'Surgical anesthesia, pain management, and critical care']
    ];

    for (const [name, code, desc] of departments) {
      await conn.query(`
        INSERT INTO departments (name, code, description, is_active)
        VALUES (?, ?, ?, 1)
        ON DUPLICATE KEY UPDATE description = VALUES(description), is_active = 1
      `, [name, code, desc]);
    }
    console.log(`  - 20 departments seeded/updated.`);

    // 7. Seed 13 Dosage Forms
    console.log('\n[3/10] Seeding 13 Dosage Forms...');
    const dosageForms = [
      ['Tablets', 'Solid oral dosage units compressed from powder or granules'],
      ['Capsules', 'Solid oral dosage encased in gelatin or plant cellulose shells'],
      ['Syrups', 'Concentrated aqueous solutions of sugar and active medication'],
      ['Suspensions', 'Liquid preparations containing insoluble solid drug particles'],
      ['Injections', 'Sterile liquid solutions, vials, or ampoules for parenteral administration'],
      ['Drops', 'Liquid dosage for eye, ear, nasal, or pediatric oral administration'],
      ['Creams', 'Semi-solid emulsions for topical dermatological application'],
      ['Ointments', 'Greasy or oily semi-solid preparations for topical healing'],
      ['Gels', 'Transparent or translucent semi-solid water-based formulations'],
      ['Inhalers', 'Pressurized metered-dose or dry powder inhalers for respiratory delivery'],
      ['Sachets', 'Single-dose powder or effervescent granules for reconstitution'],
      ['IV fluids', 'Large-volume sterile intravenous infusion solutions (Saline, Dextrose, Ringers)'],
      ['Medical devices', 'Surgical consumables, blood glucose strips, syringes, cannula']
    ];

    for (const [name, desc] of dosageForms) {
      await conn.query(`
        INSERT INTO dosage_forms (name, description, is_active)
        VALUES (?, ?, 1)
        ON DUPLICATE KEY UPDATE description = VALUES(description), is_active = 1
      `, [name, desc]);
    }
    console.log(`  - 13 dosage forms seeded/updated.`);

    // 8. Seed 15 Clinical Categories
    console.log('\n[4/10] Seeding 15 Clinical Categories...');
    const categories = [
      ['Antibiotics', 'Antibacterial and antimicrobial medications across classes'],
      ['Analgesics & Pain Relief', 'Pain relievers, NSAIDs, and opioid alternatives'],
      ['Antipyretics', 'Fever reducing medicines and antipyretic combinations'],
      ['Cardiovascular', 'Antihypertensives, statins, antiarrhythmics, and antianginals'],
      ['Antidiabetic', 'Oral hypoglycemics, insulin, and diabetes management therapies'],
      ['Gastrointestinal', 'Proton pump inhibitors, antacids, antiemetics, and antispasmodics'],
      ['Respiratory', 'Bronchodilators, antihistamines, antitussives, and mucolytics'],
      ['Dermatology', 'Topical antifungals, corticosteroids, antiseptics, and wound care'],
      ['Neurological & Psychiatric', 'Anticonvulsants, antidepressants, sedatives, and neurotonics'],
      ['Vitamins & Supplements', 'Multivitamins, minerals, iron supplements, and nutraceuticals'],
      ['Ophthalmology & ENT', 'Ophthalmic drops, ointments, otic drops, and nasal sprays'],
      ['Hormones & Endocrine', 'Thyroid therapeutics, corticosteroids, and hormonal therapies'],
      ['Antiviral & Antifungal', 'Systemic antivirals, azole antifungals, and oral protectants'],
      ['Vaccines & Biologicals', 'Immunizing vaccines, monoclonal antibodies, and serums'],
      ['Surgical & Disposables', 'Dressings, syringes, cannula, gloves, and diagnostic strips']
    ];

    for (const [name, desc] of categories) {
      await conn.query(`
        INSERT INTO categories (name, description, is_active)
        VALUES (?, ?, 1)
        ON DUPLICATE KEY UPDATE description = VALUES(description), is_active = 1
      `, [name, desc]);
    }
    console.log(`  - 15 clinical categories seeded/updated.`);

    // 9. Seed Manufacturers (matching exact columns: name, country, contact_person, phone, email, license_number, is_active)
    console.log('\n[5/10] Seeding Top Pharmaceutical Manufacturers...');
    const manufacturers = [
      ['GlaxoSmithKline (GSK) Pakistan', 'Pakistan', 'Dr. Tariq Khan', '+92-21-111-475-111', 'info.pakistan@gsk.com', 'DRAP-ML-0001', 1],
      ['Abbott Laboratories Pakistan', 'Pakistan', 'Khurram Jamil', '+92-21-35069741', 'support.pk@abbott.com', 'DRAP-ML-0002', 1],
      ['Getz Pharma', 'Pakistan', 'Rashid Khalid', '+92-21-38645000', 'info@getzpharma.com', 'DRAP-ML-0003', 1],
      ['The Searle Company', 'Pakistan', 'Bilal Ahmed', '+92-21-35684444', 'contact@searlecompany.com', 'DRAP-ML-0004', 1],
      ['Sami Pharmaceuticals', 'Pakistan', 'Hamza Sami', '+92-21-34988222', 'info@samipharmapk.com', 'DRAP-ML-0005', 1],
      ['Hilton Pharma', 'Pakistan', 'Farooq Sheikh', '+92-21-35060416', 'info@hiltonpharma.com', 'DRAP-ML-0006', 1],
      ['Ferozsons Laboratories', 'Pakistan', 'Naseem Akhtar', '+92-51-2856950', 'info@ferozsons-labs.com', 'DRAP-ML-0007', 1],
      ['Bosch Pharmaceuticals', 'Pakistan', 'Asad Bosch', '+92-21-35040405', 'info@boschpharma.com', 'DRAP-ML-0008', 1],
      ['Martin Dow', 'Pakistan', 'Ali Akhter', '+92-21-35060551', 'info@martindow.com', 'DRAP-ML-0009', 1],
      ['Barrett Hodgson', 'Pakistan', 'Zeeshan Malik', '+92-21-35061611', 'info@barretthodgson.com', 'DRAP-ML-0010', 1]
    ];

    for (const [name, country, contact, phone, email, lic, isAct] of manufacturers) {
      await conn.query(`
        INSERT INTO manufacturers (name, country, contact_person, phone, email, license_number, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE phone = VALUES(phone), email = VALUES(email)
      `, [name, country, contact, phone, email, lic, isAct]);
    }
    console.log(`  - 10 manufacturers seeded.`);

    // 10. Seed Suppliers (columns: name, contact_person, phone, email, address, city, tax_ntn_number, drug_sale_license, payment_terms, status)
    console.log('\n[6/10] Seeding Verified Pharmaceutical Suppliers...');
    const suppliers = [
      ['Medix Pharma Distributors', 'Kamran Abbasi', '+92-51-4433221', 'kamran@medixdist.com.pk', 'Warehouse 12, I-9 Industrial Area', 'Islamabad', '0123456-7', 'DSL-ISB-2022-99', 'Net 30 Days', 'active'],
      ['Capital Drug House', 'Muhammad Tariq', '+92-51-2278901', 'tariq@capitaldrughouse.com', 'Commercial Market, Satellite Town', 'Rawalpindi', '9876543-2', 'DSL-RWP-2021-45', 'Net 15 Days', 'active'],
      ['Premier Medical Supplies', 'Ahmad Raza', '+92-42-35889900', 'ahmad@premiermed.pk', 'Mall Road Distribution Hub', 'Lahore', '5432198-1', 'DSL-LHR-2020-12', 'Net 30 Days', 'active'],
      ['Prime Health Logistics', 'Zulfiqar Ali', '+92-21-34543210', 'supply@primehealthpk.com', 'Shahrah-e-Faisal', 'Karachi', '7788990-4', 'DSL-KHI-2023-88', 'Net 45 Days', 'active'],
      ['Khyber Drug Agency', 'Naseer Khan', '+92-91-5843211', 'naseer@khyberdrug.com', 'University Road', 'Peshawar', '3344556-9', 'DSL-PEW-2019-33', 'Net 20 Days', 'active']
    ];

    for (const [name, contact, phone, email, addr, city, ntn, dsl, terms, status] of suppliers) {
      await conn.query(`
        INSERT INTO suppliers (name, contact_person, phone, email, address, city, tax_ntn_number, drug_sale_license, payment_terms, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE contact_person = VALUES(contact_person), phone = VALUES(phone)
      `, [name, contact, phone, email, addr, city, ntn, dsl, terms, status]);
    }
    console.log(`  - 5 suppliers seeded.`);

    // 11. Seed Doctors
    console.log('\n[7/10] Seeding Medical Doctors...');
    const [deptRows] = await conn.query('SELECT id, name FROM departments');
    const deptMap = {};
    for (const d of deptRows) {
      deptMap[d.name] = d.id;
    }

    const doctors = [
      ['Prof. Dr. Tariq Mahmood', 'PMDC-34821-P', 'Consultant Interventional Cardiologist', deptMap['Cardiology'], 'Rawalpindi Institute of Cardiology', '+92-300-5544332', 'tariq.cardio@ric.gov.pk', 'Mon-Fri 09:00 - 13:00'],
      ['Dr. Ayesha Siddiqui', 'PMDC-48920-P', 'Associate Professor Dermatology & Aesthetics', deptMap['Dermatology'], 'Shifa International Hospital', '+92-321-7788990', 'ayesha.derm@shifa.com.pk', 'Mon-Sat 15:00 - 19:00'],
      ['Dr. Farhan Qureshi', 'PMDC-29104-P', 'Consultant Endocrinologist & Diabetologist', deptMap['Endocrinology'], 'Pakistan Institute of Medical Sciences (PIMS)', '+92-333-6655441', 'farhan.endo@pims.gov.pk', 'Tue-Thu 10:00 - 14:00'],
      ['Dr. Maryam Bilal', 'PMDC-51203-P', 'Consultant Obstetrician & Gynecologist', deptMap['Gynecology & Obstetrics'], 'PAF Hospital Islamabad', '+92-301-4455667', 'maryam.gyn@pafhospital.gov.pk', 'Mon-Fri 10:00 - 15:00'],
      ['Dr. Asim Jamil', 'PMDC-37890-P', 'Consultant Pulmonologist & Critical Care', deptMap['Pulmonology'], 'Kulsum International Hospital', '+92-312-9988776', 'asim.pulm@kulsum.com.pk', 'Mon-Sat 11:00 - 16:00'],
      ['Dr. Zeeshan Haider', 'PMDC-42110-P', 'Consultant Pediatrician & Neonatologist', deptMap['Pediatrics'], 'Children Hospital PIMS', '+92-345-2233445', 'zeeshan.ped@pims.gov.pk', 'Daily 08:30 - 14:00']
    ];

    for (const [name, pmdc, spec, deptId, hosp, phone, email, avail] of doctors) {
      const [existing] = await conn.query('SELECT id FROM doctors WHERE pmdc_number = ?', [pmdc]);
      if (existing.length === 0) {
        await conn.query(`
          INSERT INTO doctors (full_name, pmdc_number, specialization, department_id, clinic_or_hospital, phone, email, availability, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
        `, [name, pmdc, spec, deptId, hosp, phone, email, avail]);
      }
    }
    console.log(`  - Sample doctors seeded.`);

    // 12. Seed Patients
    console.log('\n[8/10] Seeding Patients with MRN & Medical Histories...');
    const patients = [
      ['PAT-202610-0001', 'Muhammad Usman', 42, '1984-06-15', 'male', '+92-300-1122334', 'usman.pk@gmail.com', 'House 14, Street 8, G-9/2, Islamabad', 'Fatima Usman', '+92-300-1122335', 'B+', 'Penicillin (Severe anaphylaxis risk)', 'Diagnosed with Type-2 Diabetes in 2021. Managed on Metformin.'],
      ['PAT-202610-0002', 'Sobia Parveen', 35, '1991-03-22', 'female', '+92-321-4455661', 'sobia.p@outlook.com', 'Flat 4B, Silver Oak, F-10 Markaz, Islamabad', 'Bilal Ahmed', '+92-321-4455662', 'O+', 'Sulfa drugs (Skin rash / Erythema)', 'Hypertension Stage 1. Mild bronchial asthma triggered by seasonal dust.'],
      ['PAT-202610-0003', 'Chaudhry Riaz', 64, '1962-11-05', 'male', '+92-333-8899001', 'riaz.ch@yahoo.com', 'Village Chaklala, Rawalpindi Cantt', 'Hamza Riaz', '+92-333-8899002', 'A+', 'None known', 'Post-CABG (2023). On maintenance antiplatelet and statin therapy.'],
      ['PAT-202610-0004', 'Zainab Bibi', 28, '1998-08-14', 'female', '+92-315-7766554', 'zainab.b@gmail.com', 'Sector I-8/4, Islamabad', 'Rashid Minhas', '+92-315-7766555', 'AB+', 'Aspirin, NSAIDs (Gastric distress)', 'First trimester pregnancy care. Prescribed folic acid and prenatal vitamins.'],
      ['PAT-202610-0005', 'Baby Rayyan', 5, '2021-04-10', 'male', '+92-345-9988112', 'parent.rayyan@gmail.com', 'Bahria Town Phase 4, Rawalpindi', 'Amna Tariq (Mother)', '+92-345-9988112', 'O+', 'None', 'Recurrent upper respiratory tract infections. No chronic illnesses.'],
      ['PAT-202610-0006', 'Khalid Munir', 51, '1975-01-20', 'male', '+92-302-3344556', 'kmunir@hotmail.com', 'Chaklala Scheme 3, Rawalpindi', 'Sadia Munir', '+92-302-3344557', 'A-', 'Erythromycin', 'Chronic acid reflux and GERD. Hypercholesterolemia.']
    ];

    for (const [mrn, name, age, dob, gender, phone, email, addr, eName, ePhone, blood, allergies, notes] of patients) {
      const [existing] = await conn.query('SELECT id FROM patients WHERE mrn = ?', [mrn]);
      if (existing.length === 0) {
        await conn.query(`
          INSERT INTO patients (mrn, full_name, age, date_of_birth, gender, phone, email, address, emergency_contact_name, emergency_contact_phone, blood_group, allergies, medical_notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [mrn, name, age, dob, gender, phone, email, addr, eName, ePhone, blood, allergies, notes]);
      }
    }
    console.log(`  - Sample patients seeded.`);

    // 13. Seed Medicines, Barcodes, and Batches
    console.log('\n[9/10] Seeding Realistic Pharmaceutical Catalogue & Batches...');

    const [cRows] = await conn.query('SELECT id, name FROM categories');
    const catMap = {};
    for (const c of cRows) catMap[c.name] = c.id;

    const [fRows] = await conn.query('SELECT id, name FROM dosage_forms');
    const formMap = {};
    for (const f of fRows) formMap[f.name] = f.id;

    const [mRows] = await conn.query('SELECT id, name FROM manufacturers');
    const manMap = {};
    for (const m of mRows) manMap[m.name] = m.id;

    const [sRows] = await conn.query('SELECT id, name FROM suppliers');
    const supMap = {};
    for (const s of sRows) supMap[s.name] = s.id;

    const medicineData = [
      {
        brand: 'Panadol',
        generic: 'Paracetamol',
        cat: 'Antipyretics',
        form: 'Tablets',
        man: 'GlaxoSmithKline (GSK) Pakistan',
        sup: 'Medix Pharma Distributors',
        strength: '500',
        strength_unit: 'mg',
        dosage_desc: '1-2 tablets every 4-6 hours as needed',
        pack_size: '200 Tablets (20x10s Blister Pack)',
        pack_unit: 'Box',
        storage: 'Store below 30°C in a dry place protected from light',
        warnings: 'Do not exceed 4000mg per 24 hours. Overdose causes liver damage.',
        desc: 'Fast-acting fever reducer and mild to moderate pain analgesic.',
        barcode: '8964000100101',
        sku: 'PAN-500-TAB',
        rx: 0,
        reorder: 50,
        cost: 450.00,
        selling: 550.00,
        qty: 120,
        batch: 'BCH-PAN-2401',
        mfg: '2024-01-10',
        exp: '2027-01-10',
        status: 'active'
      },
      {
        brand: 'Augmentin 625mg',
        generic: 'Amoxicillin + Clavulanic Acid',
        cat: 'Antibiotics',
        form: 'Tablets',
        man: 'GlaxoSmithKline (GSK) Pakistan',
        sup: 'Medix Pharma Distributors',
        strength: '625',
        strength_unit: 'mg',
        dosage_desc: 'One tablet every 12 hours with meals',
        pack_size: '14 Tablets (2x7s Blister Pack)',
        pack_unit: 'Box',
        storage: 'Store below 25°C in moisture-proof pack',
        warnings: 'Contraindicated in penicillin allergy. Complete full antibiotic course.',
        desc: 'Broad spectrum antibacterial therapy for respiratory, urinary, and dental infections.',
        barcode: '8964000100200',
        sku: 'AUG-625-TAB',
        rx: 1,
        reorder: 25,
        cost: 320.00,
        selling: 395.00,
        qty: 60,
        batch: 'BCH-AUG-2408',
        mfg: '2024-04-15',
        exp: '2026-04-15',
        status: 'active'
      },
      {
        brand: 'Risek 40mg',
        generic: 'Omeprazole',
        cat: 'Gastrointestinal',
        form: 'Capsules',
        man: 'Getz Pharma',
        sup: 'Capital Drug House',
        strength: '40',
        strength_unit: 'mg',
        dosage_desc: 'One capsule daily 30 minutes before breakfast',
        pack_size: '14 Capsules',
        pack_unit: 'Box',
        storage: 'Store below 30°C in original package',
        warnings: 'Swallow whole with liquid. Do not crush or chew beads.',
        desc: 'Potent proton pump inhibitor for GERD, peptic ulcers, and acid hypersecretion.',
        barcode: '8964000100309',
        sku: 'RSK-040-CAP',
        rx: 1,
        reorder: 30,
        cost: 410.00,
        selling: 498.00,
        qty: 85,
        batch: 'BCH-RSK-2412',
        mfg: '2024-02-01',
        exp: '2026-12-01',
        status: 'active'
      },
      {
        brand: 'Lipiget 20mg',
        generic: 'Atorvastatin Calcium',
        cat: 'Cardiovascular',
        form: 'Tablets',
        man: 'Getz Pharma',
        sup: 'Capital Drug House',
        strength: '20',
        strength_unit: 'mg',
        dosage_desc: 'One tablet once daily at bedtime',
        pack_size: '10 Tablets',
        pack_unit: 'Box',
        storage: 'Store at 20°C to 25°C protected from light',
        warnings: 'Monitor liver enzymes periodically. Avoid during pregnancy.',
        desc: 'HMG-CoA reductase inhibitor for reducing LDL cholesterol and cardiovascular risk.',
        barcode: '8964000100408',
        sku: 'LIP-020-TAB',
        rx: 1,
        reorder: 20,
        cost: 280.00,
        selling: 350.00,
        qty: 45,
        batch: 'BCH-LIP-2405',
        mfg: '2024-03-10',
        exp: '2027-03-10',
        status: 'active'
      },
      {
        brand: 'Brufen 400mg',
        generic: 'Ibuprofen',
        cat: 'Analgesics & Pain Relief',
        form: 'Tablets',
        man: 'Abbott Laboratories Pakistan',
        sup: 'Premier Medical Supplies',
        strength: '400',
        strength_unit: 'mg',
        dosage_desc: 'One tablet 3 times daily after meals',
        pack_size: '30 Tablets',
        pack_unit: 'Box',
        storage: 'Store in cool dry conditions',
        warnings: 'Take with food to prevent gastric irritation. Caution in renal impairment.',
        desc: 'Anti-inflammatory and analgesic for joint pain, musculoskeletal pain, and dysmenorrhea.',
        barcode: '8964000100507',
        sku: 'BRU-400-TAB',
        rx: 0,
        reorder: 40,
        cost: 160.00,
        selling: 210.00,
        qty: 90,
        batch: 'BCH-BRU-2402',
        mfg: '2024-01-20',
        exp: '2027-01-20',
        status: 'active'
      },
      {
        brand: 'Glucophage 500mg',
        generic: 'Metformin Hydrochloride',
        cat: 'Antidiabetic',
        form: 'Tablets',
        man: 'Martin Dow',
        sup: 'Prime Health Logistics',
        strength: '500',
        strength_unit: 'mg',
        dosage_desc: 'One tablet twice daily with breakfast and dinner',
        pack_size: '50 Tablets',
        pack_unit: 'Box',
        storage: 'Store below 25°C',
        warnings: 'Risk of lactic acidosis in severe renal impairment. Avoid excessive alcohol.',
        desc: 'First-line biguanide oral hypoglycemic for Type-2 Diabetes Mellitus.',
        barcode: '8964000100606',
        sku: 'GLU-500-TAB',
        rx: 1,
        reorder: 35,
        cost: 195.00,
        selling: 250.00,
        qty: 110,
        batch: 'BCH-GLU-2407',
        mfg: '2024-02-15',
        exp: '2027-02-15',
        status: 'active'
      },
      {
        brand: 'Ventolin Inhaler',
        generic: 'Salbutamol Sulfate',
        cat: 'Respiratory',
        form: 'Inhalers',
        man: 'GlaxoSmithKline (GSK) Pakistan',
        sup: 'Medix Pharma Distributors',
        strength: '100',
        strength_unit: 'mcg',
        dosage_desc: '1-2 puffs every 4-6 hours for acute bronchospasm',
        pack_size: '200 Metered Doses',
        pack_unit: 'Canister',
        storage: 'Protect from direct sunlight and do not freeze',
        warnings: 'Shake well before each actuation. Rinse mouth after use.',
        desc: 'Short-acting beta-2 adrenergic agonist for rapid relief of asthma and bronchospasm.',
        barcode: '8964000100705',
        sku: 'VEN-100-INH',
        rx: 1,
        reorder: 15,
        cost: 290.00,
        selling: 360.00,
        qty: 35,
        batch: 'BCH-VEN-2403',
        mfg: '2024-03-01',
        exp: '2026-09-01',
        status: 'active'
      },
      {
        brand: 'Softin 10mg',
        generic: 'Loratadine',
        cat: 'Respiratory',
        form: 'Tablets',
        man: 'Sami Pharmaceuticals',
        sup: 'Khyber Drug Agency',
        strength: '10',
        strength_unit: 'mg',
        dosage_desc: 'One tablet once daily',
        pack_size: '10 Tablets',
        pack_unit: 'Box',
        storage: 'Store at room temperature',
        warnings: 'Non-sedating second-generation antihistamine.',
        desc: 'Effective relief for seasonal allergic rhinitis, sneezing, watery eyes, and urticaria.',
        barcode: '8964000100804',
        sku: 'SOF-010-TAB',
        rx: 0,
        reorder: 25,
        cost: 110.00,
        selling: 150.00,
        qty: 70,
        batch: 'BCH-SOF-2409',
        mfg: '2024-05-10',
        exp: '2027-05-10',
        status: 'active'
      },
      {
        brand: 'Flagyl 400mg',
        generic: 'Metronidazole',
        cat: 'Gastrointestinal',
        form: 'Tablets',
        man: 'The Searle Company',
        sup: 'Premier Medical Supplies',
        strength: '400',
        strength_unit: 'mg',
        dosage_desc: 'One tablet every 8 hours for 5 to 7 days',
        pack_size: '200 Tablets',
        pack_unit: 'Box',
        storage: 'Store below 30°C',
        warnings: 'Do not consume alcohol during therapy and 48 hours after discontinuation.',
        desc: 'Antiprotozoal and anaerobic antimicrobial for amoebiasis, giardiasis, and dental sepsis.',
        barcode: '8964000100903',
        sku: 'FLA-400-TAB',
        rx: 1,
        reorder: 30,
        cost: 520.00,
        selling: 650.00,
        qty: 50,
        batch: 'BCH-FLA-2404',
        mfg: '2024-02-20',
        exp: '2027-02-20',
        status: 'active'
      },
      {
        brand: 'Polyfax Eye Ointment',
        generic: 'Polymyxin B Sulfate + Bacitracin Zinc',
        cat: 'Ophthalmology & ENT',
        form: 'Ointments',
        man: 'GlaxoSmithKline (GSK) Pakistan',
        sup: 'Medix Pharma Distributors',
        strength: '10000 IU / 500 IU',
        strength_unit: 'per g',
        dosage_desc: 'Apply ribbon of ointment into conjunctival sac 2-3 times daily',
        pack_size: '4g Tube',
        pack_unit: 'Tube',
        storage: 'Store below 25°C. Discard 30 days after opening.',
        warnings: 'For ophthalmic use only. Do not touch tube tip to any surface.',
        desc: 'Sterile antibacterial ophthalmic ointment for superficial ocular and corneal infections.',
        barcode: '8964000101009',
        sku: 'POL-EYE-OINT',
        rx: 1,
        reorder: 20,
        cost: 85.00,
        selling: 115.00,
        qty: 40,
        batch: 'BCH-POL-EXP26',
        mfg: '2023-12-01',
        exp: '2026-12-15',
        status: 'active'
      },
      {
        brand: 'Cecon 500mg Chewable',
        generic: 'Ascorbic Acid (Vitamin C)',
        cat: 'Vitamins & Supplements',
        form: 'Tablets',
        man: 'Abbott Laboratories Pakistan',
        sup: 'Premier Medical Supplies',
        strength: '500',
        strength_unit: 'mg',
        dosage_desc: 'Chew 1 tablet daily',
        pack_size: '40 Chewable Tablets',
        pack_unit: 'Box',
        storage: 'Store below 30°C in moisture tight container',
        warnings: 'Excessive consumption may have laxative effect.',
        desc: 'Essential dietary vitamin supplement for immune defense and collagen synthesis.',
        barcode: '8964000101108',
        sku: 'CEC-500-CHEW',
        rx: 0,
        reorder: 30,
        cost: 220.00,
        selling: 280.00,
        qty: 95,
        batch: 'BCH-CEC-2406',
        mfg: '2024-03-25',
        exp: '2026-09-25',
        status: 'active'
      },
      {
        brand: 'Normal Saline 0.9% IV Infusion',
        generic: 'Sodium Chloride 0.9% w/v',
        cat: 'Surgical & Disposables',
        form: 'IV fluids',
        man: 'Bosch Pharmaceuticals',
        sup: 'Prime Health Logistics',
        strength: '0.9',
        strength_unit: '%',
        dosage_desc: 'Administer intravenously under clinical supervision',
        pack_size: '1000ml Bottle',
        pack_unit: 'Bottle',
        storage: 'Store between 15°C and 30°C. Single use container.',
        warnings: 'Do not use if particulate matter or turbidity is observed.',
        desc: 'Isotonic crystalloid fluid for extracellular volume replacement and drug dilution.',
        barcode: '8964000101207',
        sku: 'SAL-1000-IV',
        rx: 1,
        reorder: 20,
        cost: 110.00,
        selling: 160.00,
        qty: 12,
        batch: 'BCH-SAL-2410',
        mfg: '2024-05-01',
        exp: '2027-05-01',
        status: 'active'
      }
    ];

    let insertedMeds = 0;
    for (const item of medicineData) {
      const cId = catMap[item.cat] || Object.values(catMap)[0];
      const fId = formMap[item.form] || Object.values(formMap)[0];
      const mId = manMap[item.man] || Object.values(manMap)[0];
      const sId = supMap[item.sup] || Object.values(supMap)[0];

      let [[existingMed]] = await conn.query('SELECT id FROM medicines WHERE brand_name = ?', [item.brand]);
      let medId;

      if (!existingMed) {
        const [res] = await conn.query(`
          INSERT INTO medicines (
            brand_name, generic_name, category_id, dosage_form_id, manufacturer_id,
            strength, strength_unit, dosage_description, pack_size, pack_unit,
            storage_instructions, warnings, description, barcode, sku,
            requires_prescription, reorder_level, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          item.brand, item.generic, cId, fId, mId,
          item.strength, item.strength_unit, item.dosage_desc, item.pack_size, item.pack_unit,
          item.storage, item.warnings, item.desc, item.barcode, item.sku,
          item.rx, item.reorder, 'active'
        ]);
        medId = res.insertId;
        insertedMeds++;
      } else {
        medId = existingMed.id;
      }

      const [existingBatch] = await conn.query('SELECT id FROM batches WHERE batch_number = ?', [item.batch]);
      if (existingBatch.length === 0) {
        await conn.query(`
          INSERT INTO batches (
            batch_number, medicine_id, supplier_id, manufacturing_date, expiry_date,
            received_date, initial_quantity, quantity_on_hand, cost_price, selling_price, status
          ) VALUES (?, ?, ?, ?, ?, CURDATE(), ?, ?, ?, ?, ?)
        `, [
          item.batch, medId, sId, item.mfg, item.exp,
          item.qty, item.qty, item.cost, item.selling, item.status
        ]);
      }
    }
    console.log(`  - Seeded ${insertedMeds} medicines with batches and barcodes.`);

    // 14. Seed Sample Expenses
    console.log('\n[Post-Seed] Seeding Sample Financial Expenses...');
    const [expCount] = await conn.query('SELECT count(*) as count FROM expenses');
    if (expCount[0].count === 0) {
      const expenses = [
        ['Pharmacy Commercial Shop Monthly Rent', 'Rent', 85000.00, '2026-10-01', 'bank_transfer', 'RENT-OCT-2026', 'Monthly rent for pharmacy premises Plaza 42'],
        ['Commercial Electricity Bill (IESCO)', 'Utilities', 34250.00, '2026-10-05', 'bank_transfer', 'IESCO-889921', 'September electricity billing with refrigeration units'],
        ['Staff Salaries - Senior Pharmacist & Cashier', 'Salaries', 120000.00, '2026-10-01', 'bank_transfer', 'SAL-OCT-2026', 'Disbursed staff payroll for October'],
        ['Cold-Chain Refrigerator Calibration & Servicing', 'Maintenance', 12500.00, '2026-10-12', 'cash', 'SERV-2026-094', 'Routine quarterly biological fridge servicing and thermostat check'],
        ['Thermal Billing Rolls & Prescription Covers', 'Supplies', 8400.00, '2026-10-18', 'cash', 'SUP-2026-441', '50 rolls 80mm thermal paper and 500 plastic medicine dispensing covers']
      ];

      for (const [title, cat, amt, date, method, ref, desc] of expenses) {
        await conn.query(`
          INSERT INTO expenses (title, category, amount, expense_date, payment_method, reference_no, description)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [title, cat, amt, date, method, ref, desc]);
      }
      console.log('  - Sample expenses seeded.');
    }

    // 15. Seed Sample Prescriptions
    console.log('\n[Post-Seed] Seeding Sample Clinical Prescriptions...');
    const [pCount] = await conn.query('SELECT count(*) as count FROM prescriptions');
    if (pCount[0].count === 0) {
      const [[doc1]] = await conn.query('SELECT id, full_name, pmdc_number, department_id, clinic_or_hospital FROM doctors LIMIT 1');
      const [[pat1]] = await conn.query('SELECT id, full_name, age, gender, phone FROM patients LIMIT 1');

      if (doc1 && pat1) {
        const [pRes] = await conn.query(`
          INSERT INTO prescriptions (
            prescription_number, patient_id, doctor_id, department_id,
            patient_name, patient_age, patient_gender, patient_phone,
            doctor_name, doctor_license_no, clinic_or_hospital,
            prescription_date, is_verified, status, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURDATE(), 1, 'verified', ?)
        `, [
          'RX-202610-001', pat1.id, doc1.id, doc1.department_id,
          pat1.full_name, pat1.age, pat1.gender, pat1.phone,
          doc1.full_name, doc1.pmdc_number, doc1.clinic_or_hospital,
          'Verified by Clinical Pharmacist. Patient allergy check cleared.'
        ]);

        const prescId = pRes.insertId;
        const [[m1]] = await conn.query('SELECT id, brand_name, dosage_description FROM medicines LIMIT 1');
        if (m1) {
          await conn.query(`
            INSERT INTO prescription_items (
              prescription_id, medicine_id, prescribed_medicine_name, dosage_instructions, prescribed_quantity, dispensed_quantity
            ) VALUES (?, ?, ?, ?, 1, 0)
          `, [prescId, m1.id, m1.brand_name, 'Take with full glass of water after food (1-0-1)']);
        }
        console.log('  - Sample prescription with items seeded.');
      }
    }

    // 16. Seed Alert Notifications
    console.log('\n[Post-Seed] Seeding Alert Notifications...');
    const [notifCount] = await conn.query('SELECT count(*) as count FROM notifications');
    if (notifCount[0].count === 0) {
      await conn.query(`
        INSERT INTO notifications (type, title, message, link) VALUES
        ('low_stock', 'Low Stock Alert: Normal Saline 0.9%', 'Only 12 bottles remaining in stock (Reorder level: 20)', '/inventory'),
        ('near_expiry', 'Near Expiry Alert: Polyfax Eye Ointment', 'Batch BCH-POL-EXP26 will expire in less than 50 days (2026-12-15)', '/inventory'),
        ('new_prescription', 'Prescription Verified: RX-202610-001', 'Prescription for Muhammad Usman is verified and ready for POS dispensing', '/prescriptions')
      `);
      console.log('  - In-app alert notifications seeded.');
    }

    // 17. Add missing permissions to Admin role & register Doctor role
    console.log('\n[Permissions] Registering New Permissions & Granting to Admin...');
    const newPerms = [
      ['doctors:view', 'doctors', 'View doctors catalogue and profiles'],
      ['doctors:manage', 'doctors', 'Add, edit, or delete doctor profiles'],
      ['patients:view', 'patients', 'View patient list and medical history'],
      ['patients:manage', 'patients', 'Add, edit, or delete patient records'],
      ['finance:view', 'finance', 'View financial summaries, P&L, and expenses'],
      ['finance:manage', 'finance', 'Record and manage pharmacy expenses'],
      ['notifications:manage', 'notifications', 'Manage in-app system notifications']
    ];

    for (const [code, module, desc] of newPerms) {
      await conn.query(`
        INSERT INTO permissions (code, module, description)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE description = VALUES(description)
      `, [code, module, desc]);
    }

    // Register doctor role if missing
    await conn.query(`
      INSERT INTO roles (name, display_name, description, is_system_role)
      VALUES ('doctor', 'Medical Doctor / Consultant', 'Access to medical inquiries, e-prescriptions, and drug availability portal', 1)
      ON DUPLICATE KEY UPDATE display_name = VALUES(display_name)
    `);

    // Assign all permissions to Admin role
    const [[adminRole]] = await conn.query("SELECT id FROM roles WHERE name = 'admin' LIMIT 1");
    if (adminRole) {
      const [allPerms] = await conn.query('SELECT id FROM permissions');
      for (const p of allPerms) {
        await conn.query(`
          INSERT INTO role_permissions (role_id, permission_id)
          VALUES (?, ?)
          ON DUPLICATE KEY UPDATE permission_id = VALUES(permission_id)
        `, [adminRole.id, p.id]);
      }
      console.log(`  - All ${allPerms.length} permissions verified for Admin role (id: ${adminRole.id}).`);
    }

    console.log('\n' + '='.repeat(70));
    console.log('  MIGRATION & SEEDING COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(70));
  } catch (err) {
    console.error('\n[FATAL ERROR IN MIGRATION]:', err);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

run();
