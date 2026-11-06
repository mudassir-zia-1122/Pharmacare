import { query } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { logAudit } from './audit.service.js';

export async function getPatients({ search, page = 1, limit = 20 }) {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
  const offsetNum = (pageNum - 1) * limitNum;

  const whereClauses = ['pat.deleted_at IS NULL'];
  const params = [];

  if (search && search.trim()) {
    whereClauses.push('(pat.full_name LIKE ? OR pat.mrn LIKE ? OR pat.phone LIKE ? OR pat.email LIKE ?)');
    const term = `%${search.trim()}%`;
    params.push(term, term, term, term);
  }

  const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const countSql = `SELECT COUNT(*) AS total FROM patients pat ${whereSql}`;
  const countRows = await query(countSql, params);
  const totalItems = countRows[0]?.total || 0;

  const dataSql = `
    SELECT pat.id, pat.mrn, pat.full_name AS fullName, pat.age,
           pat.date_of_birth AS dateOfBirth, pat.gender, pat.phone,
           pat.email, pat.address, pat.emergency_contact_name AS emergencyContactName,
           pat.emergency_contact_phone AS emergencyContactPhone, pat.blood_group AS bloodGroup,
           pat.allergies, pat.medical_notes AS medicalNotes,
           pat.created_at AS createdAt, pat.updated_at AS updatedAt,
           (SELECT COUNT(*) FROM prescriptions p WHERE p.patient_id = pat.id) AS prescriptionCount
      FROM patients pat
    ${whereSql}
     ORDER BY pat.created_at DESC
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

export async function getPatientById(id) {
  const rows = await query(
    `SELECT pat.id, pat.mrn, pat.full_name AS fullName, pat.age,
            pat.date_of_birth AS dateOfBirth, pat.gender, pat.phone,
            pat.email, pat.address, pat.emergency_contact_name AS emergencyContactName,
            pat.emergency_contact_phone AS emergencyContactPhone, pat.blood_group AS bloodGroup,
            pat.allergies, pat.medical_notes AS medicalNotes,
            pat.created_at AS createdAt, pat.updated_at AS updatedAt
       FROM patients pat
      WHERE pat.id = ? AND pat.deleted_at IS NULL`,
    [id]
  );

  if (!rows || rows.length === 0) {
    throw ApiError.notFound(`Patient with ID ${id} not found.`);
  }

  const patient = rows[0];

  // Prescriptions history
  const prescriptions = await query(
    `SELECT p.id, p.prescription_number AS prescriptionNumber, p.doctor_name AS doctorName,
            p.prescription_date AS prescriptionDate, p.is_verified AS isVerified,
            p.status, p.notes, d.name AS departmentName
       FROM prescriptions p
       LEFT JOIN departments d ON p.department_id = d.id
      WHERE p.patient_id = ?
      ORDER BY p.prescription_date DESC
      LIMIT 20`,
    [id]
  );

  return {
    ...patient,
    prescriptions,
  };
}

export async function createPatient(data, userId) {
  const {
    fullName,
    age,
    dateOfBirth,
    gender = 'male',
    phone,
    email,
    address,
    emergencyContactName,
    emergencyContactPhone,
    bloodGroup,
    allergies,
    medicalNotes,
  } = data;

  if (!fullName || !fullName.trim()) {
    throw ApiError.badRequest('Patient full name is required.');
  }

  // Generate unique MRN if not provided
  let mrn = data.mrn && data.mrn.trim();
  if (!mrn) {
    const datePrefix = new Date().toISOString().slice(0, 7).replace('-', '');
    const randSuffix = Math.floor(1000 + Math.random() * 9000);
    mrn = `PAT-${datePrefix}-${randSuffix}`;
  }

  const result = await query(
    `INSERT INTO patients (
       mrn, full_name, age, date_of_birth, gender, phone, email,
       address, emergency_contact_name, emergency_contact_phone,
       blood_group, allergies, medical_notes
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      mrn,
      fullName.trim(),
      age ? parseInt(age, 10) : null,
      dateOfBirth || null,
      gender || 'male',
      phone ? phone.trim() : null,
      email ? email.trim() : null,
      address ? address.trim() : null,
      emergencyContactName ? emergencyContactName.trim() : null,
      emergencyContactPhone ? emergencyContactPhone.trim() : null,
      bloodGroup ? bloodGroup.trim() : null,
      allergies ? allergies.trim() : null,
      medicalNotes ? medicalNotes.trim() : null,
    ]
  );

  const newId = result.insertId;

  await logAudit({
    userId,
    action: 'CREATE_PATIENT',
    table: 'patients',
    recordId: newId,
    details: { mrn, fullName, phone },
  });

  return getPatientById(newId);
}

export async function updatePatient(id, data, userId) {
  const existing = await getPatientById(id);

  const fullName = data.fullName !== undefined ? data.fullName.trim() : existing.fullName;
  const age = data.age !== undefined ? (data.age ? parseInt(data.age, 10) : null) : existing.age;
  const dateOfBirth = data.dateOfBirth !== undefined ? data.dateOfBirth : existing.dateOfBirth;
  const gender = data.gender !== undefined ? data.gender : existing.gender;
  const phone = data.phone !== undefined ? data.phone : existing.phone;
  const email = data.email !== undefined ? data.email : existing.email;
  const address = data.address !== undefined ? data.address : existing.address;
  const emergencyContactName = data.emergencyContactName !== undefined ? data.emergencyContactName : existing.emergencyContactName;
  const emergencyContactPhone = data.emergencyContactPhone !== undefined ? data.emergencyContactPhone : existing.emergencyContactPhone;
  const bloodGroup = data.bloodGroup !== undefined ? data.bloodGroup : existing.bloodGroup;
  const allergies = data.allergies !== undefined ? data.allergies : existing.allergies;
  const medicalNotes = data.medicalNotes !== undefined ? data.medicalNotes : existing.medicalNotes;

  await query(
    `UPDATE patients
        SET full_name = ?, age = ?, date_of_birth = ?, gender = ?,
            phone = ?, email = ?, address = ?, emergency_contact_name = ?,
            emergency_contact_phone = ?, blood_group = ?, allergies = ?,
            medical_notes = ?
      WHERE id = ? AND deleted_at IS NULL`,
    [
      fullName,
      age,
      dateOfBirth,
      gender,
      phone,
      email,
      address,
      emergencyContactName,
      emergencyContactPhone,
      bloodGroup,
      allergies,
      medicalNotes,
      id,
    ]
  );

  await logAudit({
    userId,
    action: 'UPDATE_PATIENT',
    table: 'patients',
    recordId: id,
    details: { mrn: existing.mrn, fullName },
  });

  return getPatientById(id);
}

export async function deletePatient(id, userId) {
  await getPatientById(id);

  await query('UPDATE patients SET deleted_at = NOW() WHERE id = ?', [id]);

  await logAudit({
    userId,
    action: 'DELETE_PATIENT',
    table: 'patients',
    recordId: id,
    details: { softDeleted: true },
  });

  return { message: 'Patient record deleted successfully.', id };
}

export async function getPatientPrescriptions(id) {
  const rows = await query(
    `SELECT p.id, p.prescription_number AS prescriptionNumber, p.doctor_name AS doctorName,
            p.prescription_date AS prescriptionDate, p.is_verified AS isVerified,
            p.status, p.notes, d.name AS departmentName
       FROM prescriptions p
       LEFT JOIN departments d ON p.department_id = d.id
      WHERE p.patient_id = ?
      ORDER BY p.prescription_date DESC`,
    [id]
  );
  return rows;
}
