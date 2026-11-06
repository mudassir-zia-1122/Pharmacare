import { query } from '../src/config/db.js';

async function runMigration() {
  console.log('='.repeat(75));
  console.log('  PharmaCare — Doctor Appointments & Queue Management Database Migration');
  console.log('='.repeat(75));

  try {
    // 1. Add Reception Role if not present
    console.log('\n[1/9] Ensuring roles table includes reception...');
    const existingRoles = await query("SELECT id, name FROM roles WHERE name = 'reception'");
    if (!existingRoles || existingRoles.length === 0) {
      await query(
        `INSERT INTO roles (name, display_name, description, is_system_role)
         VALUES ('reception', 'Front Desk & Receptionist', 'Manages patient appointments, walk-in tokens, check-ins, and clinic queue', 1)`
      );
      console.log('  ✓ Inserted "reception" role into roles table.');
    } else {
      console.log('  ✓ "reception" role already exists.');
    }

    // 2. Enhance `doctors` table
    console.log('\n[2/9] Enhancing doctors table with professional details...');
    const doctorCols = (await query('DESCRIBE doctors')).map(c => c.Field);

    const colsToAdd = [
      { name: 'qualifications', sql: 'ADD COLUMN qualifications VARCHAR(255) DEFAULT "MBBS, FCPS"' },
      { name: 'consultation_fee', sql: 'ADD COLUMN consultation_fee DECIMAL(10,2) DEFAULT 1500.00' },
      { name: 'bio', sql: 'ADD COLUMN bio TEXT NULL' },
      { name: 'available_days', sql: 'ADD COLUMN available_days VARCHAR(100) DEFAULT "Monday, Tuesday, Wednesday, Thursday, Friday"' },
      { name: 'consultation_timings', sql: 'ADD COLUMN consultation_timings VARCHAR(100) DEFAULT "09:00 AM - 02:00 PM"' },
      { name: 'verification_status', sql: 'ADD COLUMN verification_status ENUM("verified", "pending", "unverified") DEFAULT "verified"' },
      { name: 'room_number', sql: 'ADD COLUMN room_number VARCHAR(50) DEFAULT "Room 101"' },
      { name: 'max_daily_patients', sql: 'ADD COLUMN max_daily_patients INT UNSIGNED DEFAULT 30' },
    ];

    for (const col of colsToAdd) {
      if (!doctorCols.includes(col.name)) {
        await query(`ALTER TABLE doctors ${col.sql}`);
        console.log(`  ✓ Added column "${col.name}" to doctors.`);
      } else {
        console.log(`  ✓ Column "${col.name}" already exists in doctors.`);
      }
    }

    // 3. Create `doctor_schedules`
    console.log('\n[3/9] Creating doctor_schedules table...');
    await query(`
      CREATE TABLE IF NOT EXISTS doctor_schedules (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        doctor_id INT UNSIGNED NOT NULL,
        day_of_week ENUM('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday') NOT NULL,
        start_time TIME NOT NULL DEFAULT '09:00:00',
        end_time TIME NOT NULL DEFAULT '14:00:00',
        slot_duration_minutes INT UNSIGNED NOT NULL DEFAULT 15,
        max_patients INT UNSIGNED NOT NULL DEFAULT 30,
        break_start_time TIME NULL DEFAULT '12:00:00',
        break_end_time TIME NULL DEFAULT '12:30:00',
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_doc_day (doctor_id, day_of_week),
        FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('  ✓ doctor_schedules table ready.');

    // 4. Create `doctor_schedule_exceptions`
    console.log('\n[4/9] Creating doctor_schedule_exceptions table...');
    await query(`
      CREATE TABLE IF NOT EXISTS doctor_schedule_exceptions (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        doctor_id INT UNSIGNED NOT NULL,
        exception_date DATE NOT NULL,
        is_available TINYINT(1) NOT NULL DEFAULT 0,
        start_time TIME NULL,
        end_time TIME NULL,
        reason VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_doc_ex_date (doctor_id, exception_date),
        FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('  ✓ doctor_schedule_exceptions table ready.');

    // 5. Create `doctor_leaves`
    console.log('\n[5/9] Creating doctor_leaves table...');
    await query(`
      CREATE TABLE IF NOT EXISTS doctor_leaves (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        doctor_id INT UNSIGNED NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        reason TEXT NOT NULL,
        status ENUM('pending', 'approved', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending',
        approved_by_user_id INT UNSIGNED NULL,
        rejection_reason TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('  ✓ doctor_leaves table ready.');

    // 6. Create `appointments`
    console.log('\n[6/9] Creating appointments table...');
    await query(`
      CREATE TABLE IF NOT EXISTS appointments (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        appointment_reference VARCHAR(50) NOT NULL UNIQUE,
        patient_id INT UNSIGNED NULL,
        patient_name VARCHAR(150) NOT NULL,
        patient_phone VARCHAR(50) NOT NULL,
        patient_email VARCHAR(100) NULL,
        patient_age INT UNSIGNED NULL,
        patient_gender ENUM('male', 'female', 'other') DEFAULT 'male',
        doctor_id INT UNSIGNED NOT NULL,
        department_id INT UNSIGNED NOT NULL,
        appointment_date DATE NOT NULL,
        appointment_time TIME NOT NULL,
        slot_end_time TIME NOT NULL,
        appointment_type ENUM('online', 'walk_in', 'emergency') NOT NULL DEFAULT 'online',
        priority_level ENUM('normal', 'emergency') NOT NULL DEFAULT 'normal',
        status ENUM('booked', 'checked_in', 'waiting', 'in_consultation', 'completed', 'cancelled', 'no_show', 'rescheduled') NOT NULL DEFAULT 'booked',
        consultation_fee DECIMAL(10,2) NOT NULL DEFAULT 1500.00,
        payment_status ENUM('pending', 'paid', 'exempt') NOT NULL DEFAULT 'pending',
        reason_for_visit TEXT NULL,
        notes TEXT NULL,
        cancellation_reason VARCHAR(255) NULL,
        created_by_user_id INT UNSIGNED NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_apt_date_status (appointment_date, status),
        KEY idx_apt_doc_date (doctor_id, appointment_date),
        KEY idx_apt_patient (patient_id),
        KEY idx_apt_phone (patient_phone),
        FOREIGN KEY (doctor_id) REFERENCES doctors(id),
        FOREIGN KEY (department_id) REFERENCES departments(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('  ✓ appointments table ready.');

    // 7. Create `appointment_tokens`
    console.log('\n[7/9] Creating appointment_tokens table...');
    await query(`
      CREATE TABLE IF NOT EXISTS appointment_tokens (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        appointment_id INT UNSIGNED NOT NULL UNIQUE,
        doctor_id INT UNSIGNED NOT NULL,
        token_date DATE NOT NULL,
        token_number INT UNSIGNED NOT NULL,
        token_display VARCHAR(20) NOT NULL,
        status ENUM('issued', 'calling', 'serving', 'completed', 'cancelled', 'skipped') NOT NULL DEFAULT 'issued',
        issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        called_at TIMESTAMP NULL,
        completed_at TIMESTAMP NULL,
        UNIQUE KEY uk_doc_date_token (doctor_id, token_date, token_number),
        FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
        FOREIGN KEY (doctor_id) REFERENCES doctors(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('  ✓ appointment_tokens table ready.');

    // 8. Create `appointment_status_history` & `queue_priority_history`
    console.log('\n[8/9] Creating appointment status and queue priority audit tables...');
    await query(`
      CREATE TABLE IF NOT EXISTS appointment_status_history (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        appointment_id INT UNSIGNED NOT NULL,
        previous_status VARCHAR(50) NULL,
        new_status VARCHAR(50) NOT NULL,
        changed_by_user_id INT UNSIGNED NULL,
        change_reason VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS queue_priority_history (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        appointment_id INT UNSIGNED NOT NULL,
        previous_priority VARCHAR(50) NOT NULL,
        new_priority VARCHAR(50) NOT NULL,
        changed_by_user_id INT UNSIGNED NOT NULL,
        reason VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('  ✓ appointment_status_history and queue_priority_history tables ready.');

    // 9. Create `appointment_notifications`
    console.log('\n[9/9] Creating appointment_notifications table...');
    await query(`
      CREATE TABLE IF NOT EXISTS appointment_notifications (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        appointment_id INT UNSIGNED NOT NULL,
        recipient_phone VARCHAR(50) NULL,
        recipient_email VARCHAR(100) NULL,
        notification_type ENUM('booking_confirmation', 'reminder', 'queue_call', 'cancellation', 'reschedule', 'doctor_leave') NOT NULL,
        channel ENUM('email', 'sms', 'whatsapp') NOT NULL,
        status ENUM('pending', 'sent', 'failed') NOT NULL DEFAULT 'pending',
        provider_message_id VARCHAR(100) NULL,
        error_message VARCHAR(255) NULL,
        sent_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('  ✓ appointment_notifications table ready.');

    // Seed default schedules for existing 6 doctors if they have no schedules
    console.log('\n[Post-Migration] Seeding standard clinical schedules for existing doctors...');
    const doctors = await query('SELECT id, full_name FROM doctors WHERE deleted_at IS NULL');
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

    for (const doc of doctors) {
      for (const day of days) {
        await query(
          `INSERT IGNORE INTO doctor_schedules
           (doctor_id, day_of_week, start_time, end_time, slot_duration_minutes, max_patients, break_start_time, break_end_time, is_active)
           VALUES (?, ?, '09:00:00', '14:00:00', 15, 20, '12:00:00', '12:30:00', 1)`,
          [doc.id, day]
        );
      }
    }
    console.log(`  ✓ Checked and seeded weekly Monday-Friday schedules for ${doctors.length} doctors.`);

    console.log('\n' + '='.repeat(75));
    console.log('  ALL APPOINTMENT & QUEUE MIGRATIONS COMPLETED SUCCESSFULLY');
    console.log('='.repeat(75));
    process.exit(0);
  } catch (err) {
    console.error('[MIGRATION ERROR]:', err);
    process.exit(1);
  }
}

runMigration();
