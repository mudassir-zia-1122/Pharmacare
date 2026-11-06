import { query, withTransaction } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { logAudit } from './audit.service.js';
import {
  APPOINTMENT_STATUS,
  APPOINTMENT_TYPE,
  PRIORITY_LEVEL,
  TOKEN_STATUS,
} from '../config/constants.js';

/**
 * Generate discrete time slots between start and end time taking into account slot duration and breaks.
 */
function generateTimeSlots(startTime, endTime, slotMinutes, breakStart, breakEnd) {
  const slots = [];
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);

  let currentMin = startH * 60 + startM;
  const finishMin = endH * 60 + endM;

  let bStartMin = -1;
  let bEndMin = -1;
  if (breakStart && breakEnd) {
    const [bsH, bsM] = breakStart.split(':').map(Number);
    const [beH, beM] = breakEnd.split(':').map(Number);
    bStartMin = bsH * 60 + bsM;
    bEndMin = beH * 60 + beM;
  }

  while (currentMin + slotMinutes <= finishMin) {
    const slotEndMin = currentMin + slotMinutes;

    // Check if slot overlaps with break
    const overlapsBreak = (bStartMin !== -1 && bEndMin !== -1) &&
      ((currentMin >= bStartMin && currentMin < bEndMin) ||
       (slotEndMin > bStartMin && slotEndMin <= bEndMin));

    if (!overlapsBreak) {
      const h = String(Math.floor(currentMin / 60)).padStart(2, '0');
      const m = String(currentMin % 60).padStart(2, '0');
      const endHStr = String(Math.floor(slotEndMin / 60)).padStart(2, '0');
      const endMStr = String(slotEndMin % 60).padStart(2, '0');

      slots.push({
        time: `${h}:${m}:00`,
        slotEndTime: `${endHStr}:${endMStr}:00`,
        displayTime: formatTime12h(`${h}:${m}:00`),
      });
    }

    currentMin += slotMinutes;
  }

  return slots;
}

function formatTime12h(timeStr) {
  if (!timeStr) return '';
  const [hStr, mStr] = timeStr.split(':');
  let h = parseInt(hStr, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${mStr} ${ampm}`;
}

function parseTimeTo24h(timeStr) {
  if (!timeStr) return timeStr;
  const str = timeStr.toString().trim();
  const match12 = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const minutes = match12[2];
    const seconds = match12[3] || '00';
    const meridian = match12[4].toUpperCase();
    if (meridian === 'PM' && hours < 12) hours += 12;
    if (meridian === 'AM' && hours === 12) hours = 0;
    return `${String(hours).padStart(2, '0')}:${minutes}:${seconds}`;
  }
  const match24 = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (match24) {
    const hours = String(parseInt(match24[1], 10)).padStart(2, '0');
    const minutes = match24[2];
    const seconds = match24[3] || '00';
    return `${hours}:${minutes}:${seconds}`;
  }
  return str;
}

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/**
 * Get available consultation slots for a doctor on a specific date.
 */
export async function getAvailableSlots(doctorId, dateStr) {
  if (!doctorId || !dateStr) {
    throw ApiError.badRequest('Doctor ID and appointment date are required.');
  }

  const dateObj = new Date(dateStr + 'T00:00:00Z');
  if (isNaN(dateObj.getTime())) {
    throw ApiError.badRequest('Invalid date format. Use YYYY-MM-DD.');
  }

  // 1. Check doctor exists and is not soft deleted
  const [doc] = await query(
    `SELECT doc.id, doc.full_name AS fullName, doc.specialization,
            doc.status, doc.consultation_fee AS consultationFee,
            doc.room_number AS roomNumber, doc.max_daily_patients AS maxDailyPatients,
            d.id AS departmentId, d.name AS departmentName
       FROM doctors doc
       JOIN departments d ON doc.department_id = d.id
      WHERE doc.id = ? AND doc.deleted_at IS NULL`,
    [doctorId]
  );

  if (!doc) {
    throw ApiError.notFound('Doctor not found.');
  }

  if (doc.status === 'inactive') {
    return {
      doctor: doc,
      date: dateStr,
      isAvailable: false,
      reason: 'Doctor is currently inactive and not accepting appointments.',
      slots: [],
    };
  }

  // 2. Check if doctor is on approved leave on that date
  const [leave] = await query(
    `SELECT id, reason, start_date, end_date
       FROM doctor_leaves
      WHERE doctor_id = ?
        AND status = 'approved'
        AND ? BETWEEN start_date AND end_date
      LIMIT 1`,
    [doctorId, dateStr]
  );

  if (leave) {
    return {
      doctor: doc,
      date: dateStr,
      isAvailable: false,
      reason: `Doctor is on approved leave (${leave.reason || 'Annual Clinical Leave'}).`,
      slots: [],
    };
  }

  // 3. Check for specific schedule exception (e.g. hospital holiday or off-day)
  const [exception] = await query(
    `SELECT * FROM doctor_schedule_exceptions WHERE doctor_id = ? AND exception_date = ?`,
    [doctorId, dateStr]
  );

  if (exception && !exception.is_available) {
    return {
      doctor: doc,
      date: dateStr,
      isAvailable: false,
      reason: exception.reason || 'Doctor is not available on this date.',
      slots: [],
    };
  }

  // 4. Determine day of week
  const dayOfWeek = DAY_NAMES[dateObj.getUTCDay()];

  // 5. Fetch doctor schedule for this day
  const [schedule] = await query(
    `SELECT * FROM doctor_schedules WHERE doctor_id = ? AND day_of_week = ? AND is_active = 1`,
    [doctorId, dayOfWeek]
  );

  if (!schedule) {
    return {
      doctor: doc,
      date: dateStr,
      dayOfWeek,
      isAvailable: false,
      reason: `Doctor does not consult on ${dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1)}s.`,
      slots: [],
    };
  }

  // 6. Generate candidate slots
  const startTime = exception?.start_time || schedule.start_time;
  const endTime = exception?.end_time || schedule.end_time;
  const slotMinutes = schedule.slot_duration_minutes || 15;
  const breakStart = schedule.break_start_time;
  const breakEnd = schedule.break_end_time;
  const maxCapacity = schedule.max_patients || doc.maxDailyPatients || 30;

  const candidateSlots = generateTimeSlots(startTime, endTime, slotMinutes, breakStart, breakEnd);

  // 7. Fetch existing active bookings for this doctor and date
  const bookedAppointments = await query(
    `SELECT appointment_time AS appointmentTime, slot_end_time AS slotEndTime, status
       FROM appointments
      WHERE doctor_id = ?
        AND appointment_date = ?
        AND status NOT IN ('cancelled')`,
    [doctorId, dateStr]
  );

  const bookedTimeSet = new Set(bookedAppointments.map(b => b.appointmentTime));
  const activeBookingsCount = bookedAppointments.length;

  if (activeBookingsCount >= maxCapacity) {
    return {
      doctor: doc,
      date: dateStr,
      dayOfWeek,
      isAvailable: false,
      reason: 'Doctor has reached maximum daily appointment capacity for this date.',
      slots: [],
    };
  }

  const slotsWithStatus = candidateSlots.map(slot => {
    const isBooked = bookedTimeSet.has(slot.time);
    return {
      ...slot,
      isAvailable: !isBooked,
    };
  });

  return {
    doctor: doc,
    date: dateStr,
    dayOfWeek,
    isAvailable: true,
    totalSlots: slotsWithStatus.length,
    availableSlotsCount: slotsWithStatus.filter(s => s.isAvailable).length,
    slots: slotsWithStatus,
  };
}

/**
 * Core Book Appointment transaction:
 * Guarantees atomic verification, slot conflict prevention, and sequential daily token generation.
 */
export async function bookAppointment(bookingData, userId = null) {
  const {
    doctorId,
    departmentId,
    appointmentDate,
    appointmentTime,
    patientName,
    patientPhone,
    patientEmail,
    patientAge,
    patientGender = 'male',
    patientId = null,
    reasonForVisit = null,
    notes = null,
    appointmentType = APPOINTMENT_TYPE.ONLINE,
    priorityLevel = PRIORITY_LEVEL.NORMAL,
  } = bookingData;

  // Input validations
  if (!doctorId || !appointmentDate || !appointmentTime || !patientName || !patientPhone) {
    throw ApiError.badRequest('Doctor, appointment date, appointment time, patient name, and phone number are required.');
  }

  const cleanName = patientName.trim();
  const cleanPhone = patientPhone.trim();
  const cleanTime = parseTimeTo24h(appointmentTime);

  return withTransaction(async (conn) => {
    // 1. Verify doctor exists and lock row
    const [docRows] = await conn.execute(
      `SELECT doc.id, doc.full_name, doc.department_id, doc.consultation_fee, doc.status, doc.max_daily_patients
         FROM doctors doc
        WHERE doc.id = ? AND doc.deleted_at IS NULL FOR UPDATE`,
      [doctorId]
    );

    if (!docRows || docRows.length === 0) {
      throw ApiError.notFound('Doctor not found.');
    }

    const doc = docRows[0];
    if (doc.status === 'inactive') {
      throw ApiError.badRequest('Doctor is currently inactive.');
    }

    // 2. Verify doctor is not on approved leave on that date
    const [leaves] = await conn.execute(
      `SELECT id, reason FROM doctor_leaves
        WHERE doctor_id = ? AND status = 'approved' AND ? BETWEEN start_date AND end_date`,
      [doctorId, appointmentDate]
    );

    if (leaves && leaves.length > 0) {
      throw ApiError.badRequest(`Doctor is on approved leave on ${appointmentDate} (${leaves[0].reason || 'Clinical Leave'}).`);
    }

    // 3. Verify slot availability (prevent double-booking the exact same slot)
    const [existingSlot] = await conn.execute(
      `SELECT id, appointment_reference, status
         FROM appointments
        WHERE doctor_id = ?
          AND appointment_date = ?
          AND appointment_time = ?
          AND status NOT IN ('cancelled')
        FOR UPDATE`,
      [doctorId, appointmentDate, cleanTime]
    );

    if (existingSlot && existingSlot.length > 0) {
      throw ApiError.conflict(
        `This time slot (${formatTime12h(cleanTime)}) has already been booked. Please choose another slot.`
      );
    }

    // 4. Verify daily capacity
    const [dayCount] = await conn.execute(
      `SELECT COUNT(*) AS total
         FROM appointments
        WHERE doctor_id = ?
          AND appointment_date = ?
          AND status NOT IN ('cancelled')`,
      [doctorId, appointmentDate]
    );

    const maxCap = doc.max_daily_patients || 30;
    if (dayCount[0].total >= maxCap) {
      throw ApiError.badRequest(`Doctor daily capacity (${maxCap} patients) has been reached for this date.`);
    }

    // 5. Calculate slot end time based on doctor's schedule slot duration
    const dateObj = new Date(appointmentDate + 'T00:00:00Z');
    const dayName = DAY_NAMES[dateObj.getUTCDay()];
    const [sched] = await conn.execute(
      'SELECT slot_duration_minutes FROM doctor_schedules WHERE doctor_id = ? AND day_of_week = ?',
      [doctorId, dayName]
    );
    const slotDuration = sched?.[0]?.slot_duration_minutes || 15;

    const [h, m] = cleanTime.split(':').map(Number);
    const endMinutes = h * 60 + m + slotDuration;
    const endH = String(Math.floor(endMinutes / 60)).padStart(2, '0');
    const endM = String(endMinutes % 60).padStart(2, '0');
    const slotEndTime = `${endH}:${endM}:00`;

    // 6. Generate Unique Appointment Reference: APT-YYYYMM-XXXX
    const datePrefix = appointmentDate.replace(/-/g, '').slice(0, 6);
    const randSuffix = Math.floor(1000 + Math.random() * 9000);
    const appointmentReference = `APT-${datePrefix}-${randSuffix}`;

    const deptId = departmentId || doc.department_id;
    const consultationFee = parseFloat(doc.consultation_fee || 1500.00);

    // Initial appointment status
    const initialStatus = appointmentType === APPOINTMENT_TYPE.WALK_IN
      ? APPOINTMENT_STATUS.CHECKED_IN
      : APPOINTMENT_STATUS.BOOKED;

    // 7. Insert Appointment Header
    const [aptResult] = await conn.execute(
      `INSERT INTO appointments (
         appointment_reference, patient_id, patient_name, patient_phone,
         patient_email, patient_age, patient_gender, doctor_id, department_id,
         appointment_date, appointment_time, slot_end_time, appointment_type,
         priority_level, status, consultation_fee, payment_status,
         reason_for_visit, notes, created_by_user_id
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
      [
        appointmentReference,
        patientId ? parseInt(patientId, 10) : null,
        cleanName,
        cleanPhone,
        patientEmail ? patientEmail.trim() : null,
        patientAge ? parseInt(patientAge, 10) : null,
        patientGender || 'male',
        doctorId,
        deptId,
        appointmentDate,
        cleanTime,
        slotEndTime,
        appointmentType,
        priorityLevel,
        initialStatus,
        consultationFee,
        reasonForVisit ? reasonForVisit.trim() : null,
        notes ? notes.trim() : null,
        userId || null,
      ]
    );

    const appointmentId = aptResult.insertId;

    // 8. Generate sequential Daily Token for this Doctor on this Date
    // Lock token table rows for this doctor and date to guarantee sequence
    const [tokenCountRows] = await conn.execute(
      `SELECT COALESCE(MAX(token_number), 0) AS maxToken
         FROM appointment_tokens
        WHERE doctor_id = ? AND token_date = ? FOR UPDATE`,
      [doctorId, appointmentDate]
    );

    const nextTokenNumber = (tokenCountRows[0]?.maxToken || 0) + 1;
    const tokenDisplay = `T-${String(nextTokenNumber).padStart(3, '0')}`;

    const initialTokenStatus = appointmentType === APPOINTMENT_TYPE.WALK_IN
      ? TOKEN_STATUS.ISSUED
      : TOKEN_STATUS.ISSUED;

    const [tokenResult] = await conn.execute(
      `INSERT INTO appointment_tokens (
         appointment_id, doctor_id, token_date, token_number, token_display, status
       ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        appointmentId,
        doctorId,
        appointmentDate,
        nextTokenNumber,
        tokenDisplay,
        initialTokenStatus,
      ]
    );

    // 9. Record initial status history
    await conn.execute(
      `INSERT INTO appointment_status_history (
         appointment_id, previous_status, new_status, changed_by_user_id, change_reason
       ) VALUES (?, NULL, ?, ?, 'Initial Appointment Booking')`,
      [appointmentId, initialStatus, userId || null]
    );

    // 10. Record queue priority if emergency
    if (priorityLevel === PRIORITY_LEVEL.EMERGENCY) {
      await conn.execute(
        `INSERT INTO queue_priority_history (
           appointment_id, previous_priority, new_priority, changed_by_user_id, reason
         ) VALUES (?, 'normal', 'emergency', ?, 'Initial Emergency Booking')`,
        [appointmentId, userId || 1]
      );
    }

    // 11. Record notification queue entry
    await conn.execute(
      `INSERT INTO appointment_notifications (
         appointment_id, recipient_phone, recipient_email, notification_type, channel, status
       ) VALUES (?, ?, ?, 'booking_confirmation', ?, 'pending')`,
      [
        appointmentId,
        cleanPhone,
        patientEmail || null,
        patientEmail ? 'email' : 'sms',
      ]
    );

    // 12. Audit log
    await logAudit({
      userId: userId || null,
      action: 'CREATE',
      tableName: 'appointments',
      recordId: appointmentId,
      newValues: {
        appointmentReference,
        tokenDisplay,
        doctorName: doc.full_name,
        date: appointmentDate,
        time: appointmentTime,
        patientName: cleanName,
      },
      connection: conn,
    });

    return {
      id: appointmentId,
      appointmentReference,
      reference_number: appointmentReference,
      appointment_reference: appointmentReference,
      tokenNumber: nextTokenNumber,
      token_number: nextTokenNumber,
      tokenDisplay,
      token_display: tokenDisplay,
      doctorName: doc.full_name,
      doctor_name: doc.full_name,
      departmentId: deptId,
      department_id: deptId,
      appointmentDate,
      appointment_date: appointmentDate,
      appointmentTime,
      appointment_time: appointmentTime,
      slotEndTime,
      slot_end_time: slotEndTime,
      displayTime: formatTime12h(appointmentTime),
      patientName: cleanName,
      patient_name: cleanName,
      patientPhone: cleanPhone,
      patient_phone: cleanPhone,
      appointmentType,
      appointment_type: appointmentType,
      priorityLevel,
      priority_level: priorityLevel,
      status: initialStatus,
      consultationFee,
      consultation_fee: consultationFee,
      roomNumber: doc.room_number || 'Room 1',
      room_number: doc.room_number || 'Room 1',
      doctor: {
        id: doctorId,
        full_name: doc.full_name,
        specialization: doc.specialization,
        room_number: doc.room_number || 'Room 1',
      },
      appointment: {
        id: appointmentId,
        reference_number: appointmentReference,
        appointment_reference: appointmentReference,
        appointment_date: appointmentDate,
        appointment_time: appointmentTime,
        patient_name: cleanName,
        patient_phone: cleanPhone,
        consultation_fee: consultationFee,
        room_number: doc.room_number || 'Room 1',
        status: initialStatus,
      },
      token: {
        token_number: nextTokenNumber,
        token_display: tokenDisplay,
        priority_level: priorityLevel,
      },
      message: 'Appointment booked successfully. Token issued.',
    };
  });
}

/**
 * Register walk-in patient and issue instant token.
 */
export async function registerWalkInToken(data, receptionUserId) {
  const now = new Date();
  const defaultTime = now.toTimeString().slice(0, 8);
  return bookAppointment(
    {
      ...data,
      appointmentType: APPOINTMENT_TYPE.WALK_IN,
      appointmentDate: data.appointmentDate || data.date || now.toISOString().slice(0, 10),
      appointmentTime: data.appointmentTime || data.time || defaultTime,
    },
    receptionUserId
  );
}

/**
 * Public lookup for appointment details by reference and phone number.
 */
export async function lookupAppointment(reference, phone) {
  if (!reference || !phone) {
    throw ApiError.badRequest('Appointment reference and phone number are required.');
  }

  const [row] = await query(
    `SELECT a.id, a.appointment_reference AS appointmentReference,
            a.patient_name AS patientName, a.patient_phone AS patientPhone,
            a.patient_age AS patientAge, a.patient_gender AS patientGender,
            a.appointment_date AS appointmentDate, a.appointment_time AS appointmentTime,
            a.slot_end_time AS slotEndTime, a.appointment_type AS appointmentType,
            a.priority_level AS priorityLevel, a.status, a.consultation_fee AS consultationFee,
            a.reason_for_visit AS reasonForVisit, a.created_at AS createdAt,
            doc.id AS doctorId, doc.full_name AS doctorName, doc.specialization AS doctorSpecialization,
            doc.profile_photo_url AS doctorPhotoUrl, doc.room_number AS roomNumber,
            dept.id AS departmentId, dept.name AS departmentName,
            tok.token_number AS tokenNumber, tok.token_display AS tokenDisplay,
            tok.status AS tokenStatus
       FROM appointments a
       JOIN doctors doc ON a.doctor_id = doc.id
       JOIN departments dept ON a.department_id = dept.id
       LEFT JOIN appointment_tokens tok ON tok.appointment_id = a.id
      WHERE a.appointment_reference = ? AND a.patient_phone = ?`,
    [reference.trim(), phone.trim()]
  );

  if (!row) {
    throw ApiError.notFound('No appointment found matching this reference number and phone.');
  }

  return {
    ...row,
    reference_number: row.appointmentReference,
    patient_name: row.patientName,
    patient_phone: row.patientPhone,
    patient_age: row.patientAge,
    patient_gender: row.patientGender,
    age: row.patientAge,
    gender: row.patientGender,
    appointment_date: row.appointmentDate,
    appointment_time: row.appointmentTime,
    doctor_name: row.doctorName,
    doctor_specialization: row.doctorSpecialization,
    room_number: row.roomNumber,
    department_name: row.departmentName,
    token_display: row.tokenDisplay,
    token_number: row.tokenNumber,
    priority_level: row.priorityLevel,
    consultation_fee: row.consultationFee,
    displayTime: formatTime12h(row.appointmentTime),
  };
}

/**
 * Get appointments list with comprehensive filtering (Staff/Admin/Doctor/Reception).
 */
export async function getAppointments({
  date,
  doctorId,
  departmentId,
  status,
  type,
  priority,
  search,
  page = 1,
  limit = 20,
}) {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
  const offsetNum = (pageNum - 1) * limitNum;

  const whereClauses = [];
  const params = [];

  if (date) {
    whereClauses.push('a.appointment_date = ?');
    params.push(date);
  }

  if (doctorId) {
    whereClauses.push('a.doctor_id = ?');
    params.push(parseInt(doctorId, 10));
  }

  if (departmentId) {
    whereClauses.push('a.department_id = ?');
    params.push(parseInt(departmentId, 10));
  }

  if (status) {
    whereClauses.push('a.status = ?');
    params.push(status);
  }

  if (type) {
    whereClauses.push('a.appointment_type = ?');
    params.push(type);
  }

  if (priority) {
    whereClauses.push('a.priority_level = ?');
    params.push(priority);
  }

  if (search && search.trim()) {
    whereClauses.push('(a.patient_name LIKE ? OR a.patient_phone LIKE ? OR a.appointment_reference LIKE ? OR tok.token_display LIKE ?)');
    const term = `%${search.trim()}%`;
    params.push(term, term, term, term);
  }

  const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const countSql = `
    SELECT COUNT(*) AS total
      FROM appointments a
      LEFT JOIN appointment_tokens tok ON tok.appointment_id = a.id
    ${whereSql}
  `;
  const countRows = await query(countSql, params);
  const totalItems = countRows[0]?.total || 0;

  const dataSql = `
    SELECT a.id, a.appointment_reference AS appointmentReference,
           a.patient_id AS patientId, a.patient_name AS patientName,
           a.patient_phone AS patientPhone, a.patient_email AS patientEmail,
           a.patient_age AS patientAge, a.patient_gender AS patientGender,
           a.appointment_date AS appointmentDate, a.appointment_time AS appointmentTime,
           a.slot_end_time AS slotEndTime, a.appointment_type AS appointmentType,
           a.priority_level AS priorityLevel, a.status, a.consultation_fee AS consultationFee,
           a.payment_status AS paymentStatus, a.reason_for_visit AS reasonForVisit,
           a.notes, a.created_at AS createdAt,
           doc.id AS doctorId, doc.full_name AS doctorName, doc.specialization AS doctorSpecialization,
           doc.room_number AS roomNumber,
           dept.id AS departmentId, dept.name AS departmentName,
           tok.id AS tokenId, tok.token_number AS tokenNumber, tok.token_display AS tokenDisplay,
           tok.status AS tokenStatus
      FROM appointments a
      JOIN doctors doc ON a.doctor_id = doc.id
      JOIN departments dept ON a.department_id = dept.id
      LEFT JOIN appointment_tokens tok ON tok.appointment_id = a.id
    ${whereSql}
     ORDER BY (a.priority_level = 'emergency') DESC,
              a.appointment_date ASC,
              tok.token_number ASC,
              a.appointment_time ASC
     LIMIT ? OFFSET ?
  `;
  const dataRows = await query(dataSql, [...params, limitNum, offsetNum]);

  return {
    items: dataRows.map(r => ({
      ...r,
      reference_number: r.appointmentReference,
      appointment_reference: r.appointmentReference,
      patient_name: r.patientName,
      patient_phone: r.patientPhone,
      patient_age: r.patientAge,
      patient_gender: r.patientGender,
      age: r.patientAge,
      gender: r.patientGender,
      appointment_date: r.appointmentDate,
      appointment_time: r.appointmentTime,
      doctor_name: r.doctorName,
      doctor_specialization: r.doctorSpecialization,
      room_number: r.roomNumber,
      department_name: r.departmentName,
      token_display: r.tokenDisplay,
      token_number: r.tokenNumber,
      priority_level: r.priorityLevel,
      consultation_fee: r.consultationFee,
      displayTime: formatTime12h(r.appointmentTime),
    })),
    pagination: {
      page: pageNum,
      limit: limitNum,
      totalItems,
      totalPages: Math.ceil(totalItems / limitNum) || 1,
    },
  };
}

/**
 * Get appointment by ID with full audit trails.
 */
export async function getAppointmentById(id) {
  const [apt] = await query(
    `SELECT a.*,
            doc.full_name AS doctor_name, doc.specialization AS doctor_specialization,
            doc.room_number, doc.profile_photo_url,
            dept.name AS department_name,
            tok.id AS token_id, tok.token_number, tok.token_display, tok.status AS token_status
       FROM appointments a
       JOIN doctors doc ON a.doctor_id = doc.id
       JOIN departments dept ON a.department_id = dept.id
       LEFT JOIN appointment_tokens tok ON tok.appointment_id = a.id
      WHERE a.id = ?`,
    [id]
  );

  if (!apt) {
    throw ApiError.notFound('Appointment not found.');
  }

  const [statusHistory, priorityHistory] = await Promise.all([
    query(
      `SELECT ash.*, u.full_name AS changed_by_name
         FROM appointment_status_history ash
         LEFT JOIN users u ON ash.changed_by_user_id = u.id
        WHERE ash.appointment_id = ?
        ORDER BY ash.created_at DESC`,
      [id]
    ),
    query(
      `SELECT qph.*, u.full_name AS changed_by_name
         FROM queue_priority_history qph
         LEFT JOIN users u ON qph.changed_by_user_id = u.id
        WHERE qph.appointment_id = ?
        ORDER BY qph.created_at DESC`,
      [id]
    ),
  ]);

  return {
    ...apt,
    statusHistory,
    priorityHistory,
  };
}

/**
 * Update appointment status (checked_in, waiting, in_consultation, completed, cancelled, no_show).
 */
export async function updateAppointmentStatus(id, newStatus, reason = null, userId = null) {
  const validStatuses = Object.values(APPOINTMENT_STATUS);
  if (!validStatuses.includes(newStatus)) {
    throw ApiError.badRequest(`Invalid status: ${newStatus}. Valid statuses: ${validStatuses.join(', ')}`);
  }

  return withTransaction(async (conn) => {
    const [rows] = await conn.execute(
      'SELECT id, status, doctor_id, appointment_date FROM appointments WHERE id = ? FOR UPDATE',
      [id]
    );

    if (!rows || rows.length === 0) {
      throw ApiError.notFound('Appointment not found.');
    }

    const prevStatus = rows[0].status;

    // Update appointment
    await conn.execute(
      `UPDATE appointments
          SET status = ?,
              cancellation_reason = CASE WHEN ? = 'cancelled' THEN ? ELSE cancellation_reason END
        WHERE id = ?`,
      [newStatus, newStatus, reason || null, id]
    );

    // Synchronize token status
    let tokenStatus = TOKEN_STATUS.ISSUED;
    if (newStatus === APPOINTMENT_STATUS.IN_CONSULTATION) {
      tokenStatus = TOKEN_STATUS.SERVING;
      await conn.execute(
        'UPDATE appointment_tokens SET status = ?, called_at = COALESCE(called_at, CURRENT_TIMESTAMP) WHERE appointment_id = ?',
        [tokenStatus, id]
      );
    } else if (newStatus === APPOINTMENT_STATUS.COMPLETED) {
      tokenStatus = TOKEN_STATUS.COMPLETED;
      await conn.execute(
        'UPDATE appointment_tokens SET status = ?, completed_at = CURRENT_TIMESTAMP WHERE appointment_id = ?',
        [tokenStatus, id]
      );
    } else if (newStatus === APPOINTMENT_STATUS.CANCELLED) {
      tokenStatus = TOKEN_STATUS.CANCELLED;
      await conn.execute(
        'UPDATE appointment_tokens SET status = ? WHERE appointment_id = ?',
        [tokenStatus, id]
      );
    }

    // Record status history audit
    await conn.execute(
      `INSERT INTO appointment_status_history (
         appointment_id, previous_status, new_status, changed_by_user_id, change_reason
       ) VALUES (?, ?, ?, ?, ?)`,
      [id, prevStatus, newStatus, userId || null, reason || `Status changed to ${newStatus}`]
    );

    await logAudit({
      userId: userId || null,
      action: 'STATUS_CHANGE',
      tableName: 'appointments',
      recordId: id,
      newValues: { prevStatus, newStatus, reason },
      connection: conn,
    });

    return { id, previousStatus: prevStatus, newStatus, message: `Appointment status updated to ${newStatus}.` };
  });
}

/**
 * Assign controlled emergency priority with mandatory justification and audit.
 */
export async function assignEmergencyPriority(id, priorityLevel, reason, staffUserId) {
  if (!reason || !reason.trim()) {
    throw ApiError.badRequest('Mandatory clinical reason is required to modify queue priority.');
  }

  if (![PRIORITY_LEVEL.NORMAL, PRIORITY_LEVEL.EMERGENCY].includes(priorityLevel)) {
    throw ApiError.badRequest('Priority level must be normal or emergency.');
  }

  return withTransaction(async (conn) => {
    const [rows] = await conn.execute(
      'SELECT id, priority_level FROM appointments WHERE id = ? FOR UPDATE',
      [id]
    );

    if (!rows || rows.length === 0) {
      throw ApiError.notFound('Appointment not found.');
    }

    const prevPriority = rows[0].priority_level;

    await conn.execute('UPDATE appointments SET priority_level = ? WHERE id = ?', [priorityLevel, id]);

    await conn.execute(
      `INSERT INTO queue_priority_history (
         appointment_id, previous_priority, new_priority, changed_by_user_id, reason
       ) VALUES (?, ?, ?, ?, ?)`,
      [id, prevPriority, priorityLevel, staffUserId || 1, reason.trim()]
    );

    await logAudit({
      userId: staffUserId,
      action: 'UPDATE',
      tableName: 'appointments',
      recordId: id,
      newValues: { prevPriority, newPriority: priorityLevel, reason: reason.trim() },
      connection: conn,
    });

    return {
      id,
      previousPriority: prevPriority,
      newPriority: priorityLevel,
      message: `Priority updated to ${priorityLevel.toUpperCase()}.`,
    };
  });
}

/**
 * Reschedule appointment to a new date and time.
 */
export async function rescheduleAppointment(id, newDate, newTime, reason, userId) {
  if (!newDate || !newTime) {
    throw ApiError.badRequest('New appointment date and time are required.');
  }

  const existing = await getAppointmentById(id);

  // Check if target slot is already booked
  const [conflict] = await query(
    `SELECT id FROM appointments
      WHERE doctor_id = ? AND appointment_date = ? AND appointment_time = ? AND id != ? AND status NOT IN ('cancelled')`,
    [existing.doctor_id, newDate, newTime, id]
  );

  if (conflict) {
    throw ApiError.conflict('The chosen time slot on the new date is already booked.');
  }

  return withTransaction(async (conn) => {
    // Generate new token for new date
    const [tokenCountRows] = await conn.execute(
      `SELECT COALESCE(MAX(token_number), 0) AS maxToken
         FROM appointment_tokens
        WHERE doctor_id = ? AND token_date = ? FOR UPDATE`,
      [existing.doctor_id, newDate]
    );

    const nextTokenNumber = (tokenCountRows[0]?.maxToken || 0) + 1;
    const tokenDisplay = `T-${String(nextTokenNumber).padStart(3, '0')}`;

    // Update appointment
    await conn.execute(
      `UPDATE appointments
          SET appointment_date = ?,
              appointment_time = ?,
              status = 'rescheduled',
              notes = CONCAT(COALESCE(notes, ''), ' [Rescheduled from ', ?, ' ', ?, ' Reason: ', ?, ']')
        WHERE id = ?`,
      [newDate, newTime, existing.appointment_date, existing.appointment_time, reason || 'Patient request', id]
    );

    // Update token
    await conn.execute(
      `UPDATE appointment_tokens
          SET token_date = ?,
              token_number = ?,
              token_display = ?,
              status = 'issued'
        WHERE appointment_id = ?`,
      [newDate, nextTokenNumber, tokenDisplay, id]
    );

    // Audit
    await conn.execute(
      `INSERT INTO appointment_status_history (
         appointment_id, previous_status, new_status, changed_by_user_id, change_reason
       ) VALUES (?, ?, 'rescheduled', ?, ?)`,
      [id, existing.status, userId || null, reason || 'Rescheduled']
    );

    await logAudit({
      userId,
      action: 'UPDATE',
      tableName: 'appointments',
      recordId: id,
      newValues: { oldDate: existing.appointment_date, newDate, newTime, newDisplay: tokenDisplay },
      connection: conn,
    });

    return {
      id,
      newDate,
      newTime,
      tokenDisplay,
      appointment: {
        id,
        appointment_date: newDate,
        appointment_time: newTime,
        status: 'rescheduled',
      },
      token: {
        token_number: nextTokenNumber,
        token_display: tokenDisplay,
      },
      message: 'Appointment rescheduled successfully.',
    };
  });
}

/**
 * Advance Queue: Doctor calls next patient in queue.
 */
export async function callNextPatient(doctorId, date = null, staffUserId = null) {
  const targetDate = date || new Date().toISOString().slice(0, 10);

  return withTransaction(async (conn) => {
    // 1. Mark any currently serving appointment for this doctor as completed
    await conn.execute(
      `UPDATE appointment_tokens tok
         JOIN appointments a ON tok.appointment_id = a.id
          SET tok.status = 'completed', tok.completed_at = CURRENT_TIMESTAMP,
              a.status = 'completed'
        WHERE tok.doctor_id = ? AND tok.token_date = ? AND tok.status = 'serving'`,
      [doctorId, targetDate]
    );

    // 2. Find next waiting or checked_in patient, prioritized by emergency then token number
    const [nextRows] = await conn.execute(
      `SELECT a.id, a.patient_name, tok.id AS token_id, tok.token_number, tok.token_display
         FROM appointments a
         JOIN appointment_tokens tok ON tok.appointment_id = a.id
        WHERE a.doctor_id = ?
          AND a.appointment_date = ?
          AND a.status IN ('checked_in', 'waiting')
        ORDER BY (a.priority_level = 'emergency') DESC,
                 tok.token_number ASC
        LIMIT 1 FOR UPDATE`,
      [doctorId, targetDate]
    );

    if (!nextRows || nextRows.length === 0) {
      return { message: 'No waiting patients in queue for this doctor today.', calledPatient: null };
    }

    const next = nextRows[0];

    // Mark as in_consultation and calling
    await conn.execute(
      `UPDATE appointments SET status = 'in_consultation' WHERE id = ?`,
      [next.id]
    );

    await conn.execute(
      `UPDATE appointment_tokens
          SET status = 'serving', called_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
      [next.token_id]
    );

    await conn.execute(
      `INSERT INTO appointment_status_history (
         appointment_id, previous_status, new_status, changed_by_user_id, change_reason
       ) VALUES (?, 'waiting', 'in_consultation', ?, 'Called by Doctor/Queue System')`,
      [next.id, staffUserId || null]
    );

    const patientObj = {
      appointmentId: next.id,
      patientName: next.patient_name,
      patient_name: next.patient_name,
      tokenDisplay: next.token_display,
      token_display: next.token_display,
      tokenNumber: next.token_number,
      token_number: next.token_number,
    };

    return {
      message: `Called token ${next.token_display} for consultation.`,
      calledPatient: patientObj,
      callingToken: patientObj,
    };
  });
}

/**
 * Public Waiting Room Display Queue (Sanitized for large screens / TVs).
 * Hides all confidential patient details (names, phones, diagnosis).
 */
export async function getWaitingRoomDisplayQueue(date = null) {
  const targetDate = date || new Date().toISOString().slice(0, 10);

  // Fetch active doctors with appointments today
  const doctors = await query(
    `SELECT doc.id, doc.full_name AS doctorName, doc.specialization,
            doc.room_number AS roomNumber, doc.profile_photo_url AS doctorPhotoUrl,
            dept.name AS departmentName
       FROM doctors doc
       JOIN departments dept ON doc.department_id = dept.id
      WHERE doc.deleted_at IS NULL AND doc.status = 'active'
      ORDER BY dept.name ASC, doc.full_name ASC`
  );

  const displayList = [];

  for (const doc of doctors) {
    // Current serving token
    const [servingRow] = await query(
      `SELECT tok.token_display AS currentToken, tok.token_number,
              a.priority_level AS priorityLevel
         FROM appointment_tokens tok
         JOIN appointments a ON tok.appointment_id = a.id
        WHERE tok.doctor_id = ? AND tok.token_date = ? AND tok.status = 'serving'
        LIMIT 1`,
      [doc.id, targetDate]
    );

    // Next waiting tokens (up to 4 tokens)
    const nextTokensRows = await query(
      `SELECT tok.token_display AS tokenDisplay, a.priority_level AS priorityLevel
         FROM appointment_tokens tok
         JOIN appointments a ON tok.appointment_id = a.id
        WHERE tok.doctor_id = ?
          AND tok.token_date = ?
          AND a.status IN ('checked_in', 'waiting')
        ORDER BY (a.priority_level = 'emergency') DESC,
                 tok.token_number ASC
        LIMIT 4`,
      [doc.id, targetDate]
    );

    // Waiting count
    const [countRow] = await query(
      `SELECT COUNT(*) AS waitingCount
         FROM appointments a
        WHERE a.doctor_id = ? AND a.appointment_date = ? AND a.status IN ('checked_in', 'waiting')`,
      [doc.id, targetDate]
    );

    // Only include doctors who have appointments or waiting patients
    displayList.push({
      doctorId: doc.id,
      doctorName: doc.doctorName,
      specialization: doc.specialization,
      departmentName: doc.departmentName,
      roomNumber: doc.roomNumber || 'Room 101',
      doctorPhotoUrl: doc.doctorPhotoUrl,
      currentToken: servingRow?.currentToken || '—',
      currentPriority: servingRow?.priorityLevel || 'normal',
      nextTokens: nextTokensRows.map(t => t.tokenDisplay),
      waitingCount: countRow?.waitingCount || 0,
    });
  }

  return {
    clinicName: 'PharmaCare Clinical Medical Complex',
    date: targetDate,
    timestamp: new Date().toISOString(),
    doctors: displayList,
  };
}

/**
 * Detailed Clinic Reception Queue for Today.
 */
export async function getTodayQueue(doctorId = null, date = null) {
  const targetDate = date || new Date().toISOString().slice(0, 10);
  const whereClauses = ['a.appointment_date = ?'];
  const params = [targetDate];

  if (doctorId) {
    whereClauses.push('a.doctor_id = ?');
    params.push(parseInt(doctorId, 10));
  }

  const whereSql = `WHERE ${whereClauses.join(' AND ')}`;

  const rows = await query(
    `SELECT a.id, a.appointment_reference AS appointmentReference,
            a.patient_name AS patientName, a.patient_phone AS patientPhone,
            a.patient_age AS patientAge, a.patient_gender AS patientGender,
            a.appointment_time AS appointmentTime, a.appointment_type AS appointmentType,
            a.priority_level AS priorityLevel, a.status, a.consultation_fee AS consultationFee,
            a.reason_for_visit AS reasonForVisit,
            doc.id AS doctorId, doc.full_name AS doctorName, doc.room_number AS roomNumber,
            dept.name AS departmentName,
            tok.token_number AS tokenNumber, tok.token_display AS tokenDisplay,
            tok.status AS tokenStatus, tok.called_at AS calledAt
       FROM appointments a
       JOIN doctors doc ON a.doctor_id = doc.id
       JOIN departments dept ON a.department_id = dept.id
       LEFT JOIN appointment_tokens tok ON tok.appointment_id = a.id
      ${whereSql}
      ORDER BY (a.priority_level = 'emergency') DESC,
               (a.status = 'in_consultation') DESC,
               (a.status = 'waiting') DESC,
               (a.status = 'checked_in') DESC,
               tok.token_number ASC`,
    params
  );

  return rows.map(r => ({ ...r, displayTime: formatTime12h(r.appointmentTime) }));
}

/**
 * Appointment Dashboard Statistics & Summary Metrics.
 */
export async function getAppointmentStatsSummary(date = null) {
  const targetDate = date || new Date().toISOString().slice(0, 10);

  const [summary] = await query(
    `SELECT
       COUNT(*) AS totalBookings,
       COALESCE(SUM(CASE WHEN status = 'booked' THEN 1 ELSE 0 END), 0) AS booked,
       COALESCE(SUM(CASE WHEN status = 'checked_in' THEN 1 ELSE 0 END), 0) AS checkedIn,
       COALESCE(SUM(CASE WHEN status = 'waiting' THEN 1 ELSE 0 END), 0) AS waiting,
       COALESCE(SUM(CASE WHEN status = 'in_consultation' THEN 1 ELSE 0 END), 0) AS inConsultation,
       COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0) AS completed,
       COALESCE(SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END), 0) AS cancelled,
       COALESCE(SUM(CASE WHEN status = 'no_show' THEN 1 ELSE 0 END), 0) AS noShow,
       COALESCE(SUM(CASE WHEN appointment_type = 'walk_in' THEN 1 ELSE 0 END), 0) AS walkIns,
       COALESCE(SUM(CASE WHEN appointment_type = 'online' THEN 1 ELSE 0 END), 0) AS onlineBookings,
       COALESCE(SUM(CASE WHEN priority_level = 'emergency' THEN 1 ELSE 0 END), 0) AS emergencyCount,
       COALESCE(SUM(CASE WHEN status = 'completed' THEN consultation_fee ELSE 0 END), 0) AS completedRevenue
      FROM appointments
     WHERE appointment_date = ?`,
    [targetDate]
  );

  const doctorBreakdown = await query(
    `SELECT doc.id, doc.full_name AS doctorName, dept.name AS departmentName,
            COUNT(a.id) AS total,
            COALESCE(SUM(CASE WHEN a.status = 'completed' THEN 1 ELSE 0 END), 0) AS completed,
            COALESCE(SUM(CASE WHEN a.status IN ('checked_in', 'waiting', 'in_consultation') THEN 1 ELSE 0 END), 0) AS activeInQueue
       FROM doctors doc
       JOIN departments dept ON doc.department_id = dept.id
       LEFT JOIN appointments a ON a.doctor_id = doc.id AND a.appointment_date = ? AND a.status NOT IN ('cancelled')
      WHERE doc.deleted_at IS NULL AND doc.status = 'active'
      GROUP BY doc.id, doc.full_name, dept.name
      ORDER BY total DESC`,
    [targetDate]
  );

  return {
    date: targetDate,
    stats: {
      totalBookings: parseInt(summary?.totalBookings || 0, 10),
      booked: parseInt(summary?.booked || 0, 10),
      checkedIn: parseInt(summary?.checkedIn || 0, 10),
      waiting: parseInt(summary?.waiting || 0, 10),
      inConsultation: parseInt(summary?.inConsultation || 0, 10),
      completed: parseInt(summary?.completed || 0, 10),
      cancelled: parseInt(summary?.cancelled || 0, 10),
      noShow: parseInt(summary?.noShow || 0, 10),
      walkIns: parseInt(summary?.walkIns || 0, 10),
      onlineBookings: parseInt(summary?.onlineBookings || 0, 10),
      emergencyCount: parseInt(summary?.emergencyCount || 0, 10),
      completedRevenue: parseFloat(summary?.completedRevenue || 0),
    },
    doctorBreakdown,
  };
}

export default {
  getAvailableSlots,
  bookAppointment,
  registerWalkInToken,
  lookupAppointment,
  getAppointments,
  getAppointmentById,
  updateAppointmentStatus,
  assignEmergencyPriority,
  rescheduleAppointment,
  callNextPatient,
  getWaitingRoomDisplayQueue,
  getTodayQueue,
  getAppointmentStatsSummary,
};
