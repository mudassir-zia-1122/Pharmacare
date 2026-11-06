import { query, getPool } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { logAudit } from './audit.service.js';
import { PRESCRIPTION_STATUS } from '../config/constants.js';

export async function getPrescriptions({ status, search, page = 1, limit = 20 }, requestingUser) {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
  const offset = (pageNum - 1) * limitNum;
  const whereClauses = [];
  const params = [];

  if (status) {
    whereClauses.push('p.status = ?');
    params.push(status);
  }

  if (search) {
    whereClauses.push('(p.prescription_number LIKE ? OR p.patient_name LIKE ? OR p.doctor_name LIKE ?)');
    const term = `%${search}%`;
    params.push(term, term, term);
  }

  const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const countSql = `SELECT COUNT(*) AS total FROM prescriptions p ${whereSql}`;
  const countRows = await query(countSql, params);
  const totalItems = countRows[0]?.total || 0;

  const dataSql = `
    SELECT p.id, p.prescription_number AS prescriptionNumber, p.prescription_date AS prescriptionDate,
           p.patient_id AS patientId, p.patient_name AS patientName, p.patient_phone AS patientPhone,
           p.patient_age AS patientAge, p.patient_gender AS patientGender,
           p.doctor_id AS doctorId, p.doctor_name AS doctorName, p.doctor_license_no AS doctorLicenseNo,
           p.department_id AS departmentId, dept.name AS departmentName,
           p.clinic_or_hospital AS clinicOrHospital,
           p.prescription_image_path AS prescriptionImagePath, p.file_type AS fileType,
           p.is_verified AS isVerified, p.status, p.notes, p.created_at AS createdAt,
           u.full_name AS verifiedBy,
           (SELECT COUNT(*) FROM prescription_items pi WHERE pi.prescription_id = p.id) AS itemCount
      FROM prescriptions p
      LEFT JOIN users u ON p.verified_by_user_id = u.id
      LEFT JOIN departments dept ON p.department_id = dept.id
    ${whereSql}
     ORDER BY p.prescription_date DESC, p.id DESC
     LIMIT ? OFFSET ?
  `;
  const dataRows = await query(dataSql, [...params, limitNum, offset]);

  if (requestingUser) {
    await logAudit({
      userId: requestingUser.id,
      action: 'VIEW_SENSITIVE',
      table: 'prescriptions',
      recordId: 'LIST',
      details: { recordCount: dataRows.length },
    });
  }

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

export async function getPrescriptionById(id, requestingUser) {
  const rows = await query(
    `SELECT p.*, u.full_name AS verified_by_name, dept.name AS department_name
       FROM prescriptions p
       LEFT JOIN users u ON p.verified_by_user_id = u.id
       LEFT JOIN departments dept ON p.department_id = dept.id
      WHERE p.id = ?
      LIMIT 1`,
    [id]
  );

  if (!rows || rows.length === 0) {
    throw ApiError.notFound(`Prescription record not found for ID ${id}`);
  }

  const items = await query(
    `SELECT pi.*, m.brand_name, m.generic_name, m.strength, m.strength_unit,
            (SELECT COALESCE(SUM(b.quantity_on_hand), 0) FROM batches b WHERE b.medicine_id = pi.medicine_id AND b.status = 'active') AS stockOnHand
       FROM prescription_items pi
       LEFT JOIN medicines m ON pi.medicine_id = m.id
      WHERE pi.prescription_id = ?`,
    [id]
  );

  if (requestingUser) {
    await logAudit({
      userId: requestingUser.id,
      action: 'VIEW_SENSITIVE',
      table: 'prescriptions',
      recordId: id,
      details: { patientName: rows[0].patient_name },
    });
  }

  return {
    ...rows[0],
    items,
  };
}

export async function createPrescription(data, requestingUser) {
  const pool = getPool();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const patientId = data.patientId !== undefined ? data.patientId : data.patient_id;
    const patientName = data.patientName || data.patient_name;
    const patientAge = data.patientAge !== undefined ? data.patientAge : data.patient_age;
    const patientGender = data.patientGender || data.patient_gender || 'male';
    const patientPhone = data.patientPhone || data.patient_phone;
    const doctorId = data.doctorId !== undefined ? data.doctorId : data.doctor_id;
    const doctorName = data.doctorName || data.doctor_name;
    const doctorLicenseNo = data.doctorLicenseNo || data.doctor_license_no;
    const departmentId = data.departmentId !== undefined ? data.departmentId : data.department_id;
    const clinicOrHospital = data.clinicOrHospital || data.clinic_or_hospital;
    const prescriptionDate = data.prescriptionDate || data.prescription_date;
    const prescriptionImagePath = data.prescriptionImagePath || data.prescription_image_path;
    const fileType = data.fileType || data.file_type || 'image';
    const notes = data.notes;
    const items = data.items || [];

    if (!patientName || !patientName.toString().trim()) {
      throw ApiError.badRequest('Patient name is required.');
    }

    const datePrefix = new Date().toISOString().slice(0, 7).replace('-', '');
    const randSuffix = Math.floor(1000 + Math.random() * 9000);
    const prescriptionNumber = data.prescriptionNumber || `RX-${datePrefix}-${randSuffix}`;

    let finalDoctorName = doctorName ? doctorName.trim() : null;
    let finalLicense = doctorLicenseNo ? doctorLicenseNo.trim() : null;
    let finalDeptId = departmentId ? parseInt(departmentId, 10) : null;
    let finalClinic = clinicOrHospital ? clinicOrHospital.trim() : null;

    if (doctorId && !finalDoctorName) {
      const [docRows] = await conn.query('SELECT full_name, pmdc_number, department_id, clinic_or_hospital FROM doctors WHERE id = ?', [doctorId]);
      if (docRows && docRows.length > 0) {
        finalDoctorName = docRows[0].full_name;
        if (!finalLicense) finalLicense = docRows[0].pmdc_number;
        if (!finalDeptId) finalDeptId = docRows[0].department_id;
        if (!finalClinic) finalClinic = docRows[0].clinic_or_hospital;
      }
    }
    if (!finalDoctorName) {
      finalDoctorName = 'Consultant Physician';
    }

    const [res] = await conn.query(
      `INSERT INTO prescriptions (
         prescription_number, patient_id, patient_name, patient_age, patient_gender, patient_phone,
         doctor_id, doctor_name, doctor_license_no, department_id, clinic_or_hospital,
         prescription_date, prescription_image_path, file_type, notes, status, is_verified
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0)`,
      [
        prescriptionNumber,
        patientId ? parseInt(patientId, 10) : null,
        patientName.trim(),
        patientAge ? parseInt(patientAge, 10) : null,
        patientGender || 'male',
        patientPhone ? patientPhone.trim() : null,
        doctorId ? parseInt(doctorId, 10) : null,
        finalDoctorName,
        finalLicense,
        finalDeptId,
        finalClinic,
        prescriptionDate || new Date().toISOString().slice(0, 10),
        prescriptionImagePath || null,
        fileType || 'image',
        notes ? notes.trim() : null,
      ]
    );

    const prescriptionId = res.insertId;

    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        await conn.query(
          `INSERT INTO prescription_items (
             prescription_id, medicine_id, prescribed_medicine_name,
             dosage_instructions, prescribed_quantity, dispensed_quantity
           ) VALUES (?, ?, ?, ?, ?, 0)`,
          [
            prescriptionId,
            item.medicineId ? parseInt(item.medicineId, 10) : null,
            item.prescribedMedicineName || item.medicineName || 'Medication',
            item.dosageInstructions || `${item.dosage || ''} ${item.frequency || ''} ${item.duration || ''}`.trim(),
            item.prescribedQuantity ? parseInt(item.prescribedQuantity, 10) : 1,
          ]
        );
      }
    }

    await conn.commit();

    await logAudit({
      userId: requestingUser?.id,
      action: 'CREATE_PRESCRIPTION',
      table: 'prescriptions',
      recordId: prescriptionId,
      details: { prescriptionNumber, patientName },
    });

    return getPrescriptionById(prescriptionId, requestingUser);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function verifyPrescription(id, pharmacistUserId, { status = 'verified', notes } = {}) {
  const existing = await query('SELECT * FROM prescriptions WHERE id = ?', [id]);
  if (!existing || existing.length === 0) {
    throw ApiError.notFound('Prescription not found');
  }

  const isVerified = status === 'verified' || status === 'dispensed';

  await query(
    `UPDATE prescriptions
        SET is_verified = ?,
            verified_by_user_id = ?,
            verified_at = CURRENT_TIMESTAMP,
            status = ?,
            notes = COALESCE(?, notes)
      WHERE id = ?`,
    [isVerified ? 1 : 0, pharmacistUserId, status, notes || null, id]
  );

  await logAudit({
    userId: pharmacistUserId,
    action: 'STATUS_CHANGE',
    table: 'prescriptions',
    recordId: id,
    details: { status, verifiedBy: pharmacistUserId },
  });

  return { message: `Prescription updated to ${status} successfully.`, id, status };
}

export default {
  getPrescriptions,
  getPrescriptionById,
  createPrescription,
  verifyPrescription,
};
