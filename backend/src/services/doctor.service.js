import { query } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { logAudit } from './audit.service.js';

export async function getDoctors({ search, departmentId, status, page = 1, limit = 20 }) {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
  const offsetNum = (pageNum - 1) * limitNum;

  const whereClauses = ['doc.deleted_at IS NULL'];
  const params = [];

  if (search && search.trim()) {
    whereClauses.push('(doc.full_name LIKE ? OR doc.pmdc_number LIKE ? OR doc.specialization LIKE ? OR doc.clinic_or_hospital LIKE ? OR doc.qualifications LIKE ?)');
    const term = `%${search.trim()}%`;
    params.push(term, term, term, term, term);
  }

  if (departmentId) {
    whereClauses.push('doc.department_id = ?');
    params.push(parseInt(departmentId, 10));
  }

  if (status && ['active', 'inactive', 'on_leave'].includes(status)) {
    whereClauses.push('doc.status = ?');
    params.push(status);
  }

  const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const countSql = `SELECT COUNT(*) AS total FROM doctors doc ${whereSql}`;
  const countRows = await query(countSql, params);
  const totalItems = countRows[0]?.total || 0;

  const dataSql = `
    SELECT doc.id, doc.full_name AS fullName, doc.pmdc_number AS pmdcNumber,
           doc.specialization, doc.department_id AS departmentId,
           d.name AS departmentName, d.code AS departmentCode,
           doc.clinic_or_hospital AS clinicOrHospital, doc.phone, doc.email,
           doc.address, doc.availability, doc.profile_photo_url AS profilePhotoUrl,
           doc.qualifications, doc.consultation_fee AS consultationFee,
           doc.bio, doc.available_days AS availableDays,
           doc.consultation_timings AS consultationTimings,
           doc.verification_status AS verificationStatus,
           doc.room_number AS roomNumber, doc.max_daily_patients AS maxDailyPatients,
           doc.status, doc.created_at AS createdAt, doc.updated_at AS updatedAt,
           (SELECT COUNT(*) FROM prescriptions p WHERE p.doctor_id = doc.id) AS prescriptionCount,
           (SELECT COUNT(*) FROM appointments a WHERE a.doctor_id = doc.id AND a.appointment_date = CURRENT_DATE AND a.status NOT IN ('cancelled')) AS todayAppointmentsCount
      FROM doctors doc
      LEFT JOIN departments d ON doc.department_id = d.id
    ${whereSql}
     ORDER BY doc.full_name ASC
     LIMIT ? OFFSET ?
  `;
  const dataRows = await query(dataSql, [...params, limitNum, offsetNum]);

  return {
    items: dataRows,
    pagination: {
      page: pageNum,
      limit: limitNum,
      totalItems,
      totalPages: Math.ceil(totalItems / limitNum) || 1,
    },
  };
}

export async function getDoctorById(id) {
  const rows = await query(
    `SELECT doc.id, doc.full_name AS fullName, doc.pmdc_number AS pmdcNumber,
            doc.specialization, doc.department_id AS departmentId,
            d.name AS departmentName, d.code AS departmentCode,
            doc.clinic_or_hospital AS clinicOrHospital, doc.phone, doc.email,
            doc.address, doc.availability, doc.profile_photo_url AS profilePhotoUrl,
            doc.qualifications, doc.consultation_fee AS consultationFee,
            doc.bio, doc.available_days AS availableDays,
            doc.consultation_timings AS consultationTimings,
            doc.verification_status AS verificationStatus,
            doc.room_number AS roomNumber, doc.max_daily_patients AS maxDailyPatients,
            doc.status, doc.created_at AS createdAt, doc.updated_at AS updatedAt,
            (SELECT COUNT(*) FROM prescriptions p WHERE p.doctor_id = doc.id) AS prescriptionCount
       FROM doctors doc
       LEFT JOIN departments d ON doc.department_id = d.id
      WHERE doc.id = ? AND doc.deleted_at IS NULL`,
    [id]
  );

  if (!rows || rows.length === 0) {
    throw ApiError.notFound(`Doctor with ID ${id} not found.`);
  }

  const doctor = rows[0];

  // Fetch weekly schedules
  const schedules = await query(
    `SELECT id, day_of_week AS dayOfWeek, start_time AS startTime,
            end_time AS endTime, slot_duration_minutes AS slotDurationMinutes,
            max_patients AS maxPatients, break_start_time AS breakStartTime,
            break_end_time AS breakEndTime, is_active AS isActive
       FROM doctor_schedules
      WHERE doctor_id = ?
      ORDER BY FIELD(day_of_week, 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')`,
    [id]
  );

  // Fetch approved active/future leaves
  const leaves = await query(
    `SELECT id, start_date AS startDate, end_date AS endDate, reason, status
       FROM doctor_leaves
      WHERE doctor_id = ? AND status = 'approved' AND end_date >= CURRENT_DATE
      ORDER BY start_date ASC`,
    [id]
  );

  // Fetch recent prescriptions
  const recentPrescriptions = await query(
    `SELECT id, prescription_number AS prescriptionNumber, patient_name AS patientName,
            prescription_date AS prescriptionDate, is_verified AS isVerified, status
       FROM prescriptions
      WHERE doctor_id = ?
      ORDER BY prescription_date DESC
      LIMIT 10`,
    [id]
  );

  return {
    ...doctor,
    schedules: schedules || [],
    leaves: leaves || [],
    recentPrescriptions: recentPrescriptions || [],
  };
}

export async function createDoctor(data, userId) {
  const {
    fullName,
    pmdcNumber,
    specialization,
    departmentId,
    clinicOrHospital,
    phone,
    email,
    address,
    availability,
    profilePhotoUrl,
    qualifications = 'MBBS, FCPS',
    consultationFee = 1500.00,
    bio,
    availableDays = 'Monday, Tuesday, Wednesday, Thursday, Friday',
    consultationTimings = '09:00 AM - 02:00 PM',
    verificationStatus = 'verified',
    roomNumber = 'Room 101',
    maxDailyPatients = 30,
    status = 'active',
  } = data;

  if (!fullName || !fullName.trim()) {
    throw ApiError.badRequest('Doctor full name is required.');
  }
  if (!pmdcNumber || !pmdcNumber.trim()) {
    throw ApiError.badRequest('PMDC registration number is required.');
  }
  if (!specialization || !specialization.trim()) {
    throw ApiError.badRequest('Doctor specialization is required.');
  }

  const result = await query(
    `INSERT INTO doctors (
       full_name, pmdc_number, specialization, department_id,
       clinic_or_hospital, phone, email, address, availability,
       profile_photo_url, qualifications, consultation_fee,
       bio, available_days, consultation_timings,
       verification_status, room_number, max_daily_patients, status
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      fullName.trim(),
      pmdcNumber.trim(),
      specialization.trim(),
      departmentId ? parseInt(departmentId, 10) : null,
      clinicOrHospital ? clinicOrHospital.trim() : null,
      phone ? phone.trim() : null,
      email ? email.trim() : null,
      address ? address.trim() : null,
      availability ? availability.trim() : null,
      profilePhotoUrl ? profilePhotoUrl.trim() : null,
      qualifications ? qualifications.trim() : 'MBBS, FCPS',
      consultationFee ? parseFloat(consultationFee) : 1500.00,
      bio ? bio.trim() : null,
      availableDays ? availableDays.trim() : 'Monday, Tuesday, Wednesday, Thursday, Friday',
      consultationTimings ? consultationTimings.trim() : '09:00 AM - 02:00 PM',
      verificationStatus || 'verified',
      roomNumber || 'Room 101',
      maxDailyPatients ? parseInt(maxDailyPatients, 10) : 30,
      status || 'active',
    ]
  );

  const newId = result.insertId;

  // Auto-seed default Monday to Friday schedule
  const defaultDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
  for (const day of defaultDays) {
    await query(
      `INSERT IGNORE INTO doctor_schedules
       (doctor_id, day_of_week, start_time, end_time, slot_duration_minutes, max_patients, break_start_time, break_end_time, is_active)
       VALUES (?, ?, '09:00:00', '14:00:00', 15, 20, '12:00:00', '12:30:00', 1)`,
      [newId, day]
    );
  }

  await logAudit({
    userId,
    action: 'CREATE',
    tableName: 'doctors',
    recordId: newId,
    newValues: { fullName, pmdcNumber, specialization, departmentId },
  });

  return getDoctorById(newId);
}

export async function updateDoctor(id, data, userId) {
  const existing = await getDoctorById(id);

  const fullName = data.fullName !== undefined ? data.fullName.trim() : existing.fullName;
  const pmdcNumber = data.pmdcNumber !== undefined ? data.pmdcNumber.trim() : existing.pmdcNumber;
  const specialization = data.specialization !== undefined ? data.specialization.trim() : existing.specialization;
  const departmentId = data.departmentId !== undefined ? (data.departmentId ? parseInt(data.departmentId, 10) : null) : existing.departmentId;
  const clinicOrHospital = data.clinicOrHospital !== undefined ? data.clinicOrHospital : existing.clinicOrHospital;
  const phone = data.phone !== undefined ? data.phone : existing.phone;
  const email = data.email !== undefined ? data.email : existing.email;
  const address = data.address !== undefined ? data.address : existing.address;
  const availability = data.availability !== undefined ? data.availability : existing.availability;
  const profilePhotoUrl = data.profilePhotoUrl !== undefined ? data.profilePhotoUrl : existing.profilePhotoUrl;
  const qualifications = data.qualifications !== undefined ? data.qualifications : existing.qualifications;
  const consultationFee = data.consultationFee !== undefined ? parseFloat(data.consultationFee) : existing.consultationFee;
  const bio = data.bio !== undefined ? data.bio : existing.bio;
  const availableDays = data.availableDays !== undefined ? data.availableDays : existing.availableDays;
  const consultationTimings = data.consultationTimings !== undefined ? data.consultationTimings : existing.consultationTimings;
  const verificationStatus = data.verificationStatus !== undefined ? data.verificationStatus : existing.verificationStatus;
  const roomNumber = data.roomNumber !== undefined ? data.roomNumber : existing.roomNumber;
  const maxDailyPatients = data.maxDailyPatients !== undefined ? parseInt(data.maxDailyPatients, 10) : existing.maxDailyPatients;
  const status = data.status !== undefined ? data.status : existing.status;

  await query(
    `UPDATE doctors
        SET full_name = ?, pmdc_number = ?, specialization = ?, department_id = ?,
            clinic_or_hospital = ?, phone = ?, email = ?, address = ?,
            availability = ?, profile_photo_url = ?, qualifications = ?,
            consultation_fee = ?, bio = ?, available_days = ?,
            consultation_timings = ?, verification_status = ?, room_number = ?,
            max_daily_patients = ?, status = ?
      WHERE id = ? AND deleted_at IS NULL`,
    [
      fullName,
      pmdcNumber,
      specialization,
      departmentId,
      clinicOrHospital,
      phone,
      email,
      address,
      availability,
      profilePhotoUrl,
      qualifications,
      consultationFee,
      bio,
      availableDays,
      consultationTimings,
      verificationStatus,
      roomNumber,
      maxDailyPatients,
      status,
      id,
    ]
  );

  await logAudit({
    userId,
    action: 'UPDATE',
    tableName: 'doctors',
    recordId: id,
    newValues: { fullName, pmdcNumber, specialization, status },
  });

  return getDoctorById(id);
}

export async function updateDoctorPhoto(id, photoUrl, userId) {
  await getDoctorById(id);
  await query('UPDATE doctors SET profile_photo_url = ? WHERE id = ?', [photoUrl, id]);
  await logAudit({
    userId,
    action: 'UPDATE',
    tableName: 'doctors',
    recordId: id,
    newValues: { profilePhotoUrl: photoUrl },
  });
  return { id, profilePhotoUrl: photoUrl, message: 'Doctor photograph updated successfully.' };
}

export async function removeDoctorPhoto(id, userId) {
  await getDoctorById(id);
  await query('UPDATE doctors SET profile_photo_url = NULL WHERE id = ?', [id]);
  await logAudit({
    userId,
    action: 'UPDATE',
    tableName: 'doctors',
    recordId: id,
    newValues: { profilePhotoUrl: null },
  });
  return { id, profilePhotoUrl: null, message: 'Doctor photograph removed successfully.' };
}

export async function deleteDoctor(id, userId) {
  await getDoctorById(id);
  await query('UPDATE doctors SET deleted_at = NOW() WHERE id = ?', [id]);
  await logAudit({
    userId,
    action: 'DELETE',
    tableName: 'doctors',
    recordId: id,
    newValues: { softDeleted: true },
  });
  return { message: 'Doctor deleted successfully.', id };
}

export async function getDoctorSchedule(doctorId) {
  await getDoctorById(doctorId);
  const rows = await query(
    `SELECT id, day_of_week AS dayOfWeek, start_time AS startTime,
            end_time AS endTime, slot_duration_minutes AS slotDurationMinutes,
            max_patients AS maxPatients, break_start_time AS breakStartTime,
            break_end_time AS breakEndTime, is_active AS isActive
       FROM doctor_schedules
      WHERE doctor_id = ?
      ORDER BY FIELD(day_of_week, 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')`,
    [doctorId]
  );
  return rows;
}

export async function saveDoctorSchedule(doctorId, scheduleList, userId) {
  await getDoctorById(doctorId);

  for (const item of scheduleList) {
    const {
      dayOfWeek,
      startTime = '09:00:00',
      endTime = '14:00:00',
      slotDurationMinutes = 15,
      maxPatients = 30,
      breakStartTime = '12:00:00',
      breakEndTime = '12:30:00',
      isActive = 1,
    } = item;

    if (!dayOfWeek) continue;

    await query(
      `INSERT INTO doctor_schedules
       (doctor_id, day_of_week, start_time, end_time, slot_duration_minutes, max_patients, break_start_time, break_end_time, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         start_time = VALUES(start_time),
         end_time = VALUES(end_time),
         slot_duration_minutes = VALUES(slot_duration_minutes),
         max_patients = VALUES(max_patients),
         break_start_time = VALUES(break_start_time),
         break_end_time = VALUES(break_end_time),
         is_active = VALUES(is_active)`,
      [
        doctorId,
        dayOfWeek.toLowerCase(),
        startTime,
        endTime,
        parseInt(slotDurationMinutes, 10) || 15,
        parseInt(maxPatients, 10) || 30,
        breakStartTime || null,
        breakEndTime || null,
        isActive ? 1 : 0,
      ]
    );
  }

  await logAudit({
    userId,
    action: 'UPDATE',
    tableName: 'doctor_schedules',
    recordId: doctorId,
    newValues: { scheduleCount: scheduleList.length },
  });

  return getDoctorSchedule(doctorId);
}

export async function getDoctorLeaves({ doctorId, status, page = 1, limit = 20 }) {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
  const offsetNum = (pageNum - 1) * limitNum;

  const whereClauses = [];
  const params = [];

  if (doctorId) {
    whereClauses.push('dl.doctor_id = ?');
    params.push(parseInt(doctorId, 10));
  }

  if (status) {
    whereClauses.push('dl.status = ?');
    params.push(status);
  }

  const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const countRows = await query(`SELECT COUNT(*) AS total FROM doctor_leaves dl ${whereSql}`, params);
  const totalItems = countRows[0]?.total || 0;

  const rows = await query(
    `SELECT dl.id, dl.doctor_id AS doctorId, doc.full_name AS doctorName,
            dl.start_date AS startDate, dl.end_date AS endDate,
            dl.reason, dl.status, dl.rejection_reason AS rejectionReason,
            u.full_name AS approvedByName, dl.created_at AS createdAt,
            (SELECT COUNT(*) FROM appointments a
              WHERE a.doctor_id = dl.doctor_id
                AND a.appointment_date BETWEEN dl.start_date AND dl.end_date
                AND a.status NOT IN ('cancelled', 'completed')) AS affectedAppointmentsCount
       FROM doctor_leaves dl
       JOIN doctors doc ON dl.doctor_id = doc.id
       LEFT JOIN users u ON dl.approved_by_user_id = u.id
      ${whereSql}
      ORDER BY dl.start_date DESC
      LIMIT ? OFFSET ?`,
    [...params, limitNum, offsetNum]
  );

  return {
    items: rows,
    pagination: {
      page: pageNum,
      limit: limitNum,
      totalItems,
      totalPages: Math.ceil(totalItems / limitNum) || 1,
    },
  };
}

export async function createDoctorLeave(data, userId) {
  const { doctorId, startDate, endDate, reason } = data;
  if (!doctorId || !startDate || !endDate || !reason || !reason.trim()) {
    throw ApiError.badRequest('Doctor, start date, end date, and reason are required for leave application.');
  }

  if (new Date(endDate) < new Date(startDate)) {
    throw ApiError.badRequest('Leave end date cannot be earlier than start date.');
  }

  const result = await query(
    `INSERT INTO doctor_leaves (doctor_id, start_date, end_date, reason, status)
     VALUES (?, ?, ?, ?, 'pending')`,
    [parseInt(doctorId, 10), startDate, endDate, reason.trim()]
  );

  const leaveId = result.insertId;

  // Check affected appointments count
  const [affectedRow] = await query(
    `SELECT COUNT(*) AS affectedCount
       FROM appointments
      WHERE doctor_id = ?
        AND appointment_date BETWEEN ? AND ?
        AND status NOT IN ('cancelled', 'completed')`,
    [parseInt(doctorId, 10), startDate, endDate]
  );

  await logAudit({
    userId,
    action: 'CREATE',
    tableName: 'doctor_leaves',
    recordId: leaveId,
    newValues: { doctorId, startDate, endDate, affectedAppointments: affectedRow?.affectedCount || 0 },
  });

  return {
    id: leaveId,
    doctorId,
    startDate,
    endDate,
    reason,
    status: 'pending',
    affectedAppointmentsCount: affectedRow?.affectedCount || 0,
    message: 'Doctor leave request submitted successfully.',
  };
}

export async function updateDoctorLeaveStatus(id, { status, rejectionReason }, userId) {
  if (!['approved', 'rejected', 'cancelled'].includes(status)) {
    throw ApiError.badRequest('Status must be approved, rejected, or cancelled.');
  }

  const [leave] = await query('SELECT * FROM doctor_leaves WHERE id = ?', [id]);
  if (!leave) {
    throw ApiError.notFound('Leave request not found.');
  }

  await query(
    `UPDATE doctor_leaves
        SET status = ?,
            approved_by_user_id = ?,
            rejection_reason = COALESCE(?, rejection_reason)
      WHERE id = ?`,
    [status, userId, rejectionReason || null, id]
  );

  // If approved, update doctor status to 'on_leave' if current date falls within range
  if (status === 'approved') {
    const today = new Date().toISOString().slice(0, 10);
    if (today >= leave.start_date && today <= leave.end_date) {
      await query('UPDATE doctors SET status = "on_leave" WHERE id = ?', [leave.doctor_id]);
    }
  }

  await logAudit({
    userId,
    action: 'STATUS_CHANGE',
    tableName: 'doctor_leaves',
    recordId: id,
    newValues: { status, rejectionReason },
  });

  return { id, status, message: `Doctor leave request marked as ${status}.` };
}

export async function getDepartments() {
  const rows = await query(`
    SELECT d.id, d.name, d.code, d.description, d.is_active AS isActive,
           (SELECT COUNT(*) FROM doctors doc WHERE doc.department_id = d.id AND doc.deleted_at IS NULL) AS doctorCount
      FROM departments d
     WHERE d.is_active = 1
     ORDER BY d.name ASC
  `);
  return rows;
}

export default {
  getDoctors,
  getDoctorById,
  createDoctor,
  updateDoctor,
  updateDoctorPhoto,
  removeDoctorPhoto,
  deleteDoctor,
  getDoctorSchedule,
  saveDoctorSchedule,
  getDoctorLeaves,
  createDoctorLeave,
  updateDoctorLeaveStatus,
  getDepartments,
};
