import { query } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import emailService from './email.service.js';
import storageService from './storage.service.js';
import { logAudit } from './audit.service.js';

/**
 * Generate a unique, professional reference number: INQ-YYYYMMDD-XXXX
 */
function generateReferenceNumber() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `INQ-${dateStr}-${randomSuffix}`;
}

export async function createInquiry(data, file) {
  const { doctorName, clinicHospitalName, email, phone, manualNotes } = data;

  if (!doctorName || !clinicHospitalName || !email) {
    throw ApiError.badRequest('Doctor name, clinic/hospital name, and email are required');
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    throw ApiError.badRequest('A valid email address is required');
  }

  // Ensure either prescription photo or text notes are provided
  if (!file && (!manualNotes || !manualNotes.trim())) {
    throw ApiError.badRequest('Please upload a prescription photo or enter the requested medicine details in notes.');
  }

  let referenceNo = generateReferenceNumber();
  let isUnique = false;
  let attempts = 0;

  // Collision prevention
  while (!isUnique && attempts < 5) {
    const existing = await query('SELECT id FROM doctor_inquiries WHERE reference_no = ? LIMIT 1', [referenceNo]);
    if (!existing || existing.length === 0) {
      isUnique = true;
    } else {
      referenceNo = generateReferenceNumber();
      attempts++;
    }
  }

  let imageFilename = null;
  let imageOriginalName = null;
  let imageMimeType = null;
  let imageSizeBytes = null;

  if (file) {
    const uploaded = await storageService.uploadPrivatePrescription(file);
    imageFilename = uploaded.storageKey;
    imageOriginalName = uploaded.originalName;
    imageMimeType = uploaded.mimeType;
    imageSizeBytes = uploaded.size;
  }

  const result = await query(
    `INSERT INTO doctor_inquiries
     (reference_no, doctor_name, clinic_hospital_name, email, phone, manual_notes,
      image_filename, image_original_name, image_mime_type, image_size_bytes, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [
      referenceNo,
      doctorName.trim(),
      clinicHospitalName.trim(),
      email.toLowerCase().trim(),
      phone ? phone.trim() : null,
      manualNotes ? manualNotes.trim() : null,
      imageFilename,
      imageOriginalName,
      imageMimeType,
      imageSizeBytes,
    ]
  );

  const inquiryId = result.insertId;

  const inquiryRecord = {
    id: inquiryId,
    reference_no: referenceNo,
    doctor_name: doctorName.trim(),
    clinic_hospital_name: clinicHospitalName.trim(),
    email: email.toLowerCase().trim(),
    phone: phone ? phone.trim() : null,
    manual_notes: manualNotes ? manualNotes.trim() : null,
    has_image: Boolean(file),
    image_filename: imageFilename,
  };

  // Asynchronously dispatch confirmation email to doctor (non-blocking for UI submission speed)
  emailService.sendInquiryConfirmation(inquiryRecord).catch((err) => {
    console.error('[INQUIRY CONFIRMATION EMAIL ERROR]', err);
  });

  // Asynchronously dispatch notification email to pharmacy dispensary
  emailService.sendPharmacyNewInquiryNotification(inquiryRecord).catch((err) => {
    console.error('[PHARMACY NOTIFICATION EMAIL ERROR]', err);
  });

  return {
    id: inquiryId,
    referenceNo,
    doctorName,
    clinicHospitalName,
    email,
    status: 'pending',
    hasImage: Boolean(file),
  };
}

export async function getInquiries({ status, search, page = 1, limit = 20 }) {
  const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
  const conditions = [];
  const params = [];

  if (status) {
    conditions.push('di.status = ?');
    params.push(status);
  }

  if (search && search.trim()) {
    conditions.push(
      '(di.reference_no LIKE ? OR di.doctor_name LIKE ? OR di.clinic_hospital_name LIKE ? OR di.email LIKE ?)'
    );
    const term = `%${search.trim()}%`;
    params.push(term, term, term, term);
  }

  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countSql = `SELECT COUNT(*) AS total FROM doctor_inquiries di ${whereSql}`;
  const totalRows = await query(countSql, params);
  const totalItems = totalRows[0]?.total || 0;

  const dataSql = `
    SELECT di.id, di.reference_no AS referenceNo, di.doctor_name AS doctorName,
           di.clinic_hospital_name AS clinicHospitalName, di.email, di.phone,
           di.manual_notes AS manualNotes,
           di.image_filename AS imageFilename,
           di.status, di.email_status AS emailStatus,
           di.email_error AS emailError, di.email_sent_at AS emailSentAt,
           di.created_at AS createdAt, di.updated_at AS updatedAt,
           u.full_name AS reviewedByName,
           (SELECT COUNT(*) FROM doctor_inquiry_items dii WHERE dii.inquiry_id = di.id) AS itemCount
      FROM doctor_inquiries di
      LEFT JOIN users u ON di.reviewed_by_user_id = u.id
    ${whereSql}
     ORDER BY di.created_at DESC
     LIMIT ? OFFSET ?
  `;

  const rows = await query(dataSql, [...params, parseInt(limit, 10), offset]);

  return {
    items: rows,
    pagination: {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      totalItems,
      totalPages: Math.ceil(totalItems / limit) || 1,
    },
  };
}

export async function getInquiryById(id) {
  const inquiries = await query(
    `SELECT di.id, di.reference_no AS referenceNo, di.doctor_name AS doctorName,
            di.clinic_hospital_name AS clinicHospitalName, di.email, di.phone,
            di.manual_notes AS manualNotes,
            di.image_filename AS imageFilename, di.image_original_name AS imageOriginalName,
            di.image_mime_type AS imageMimeType, di.image_size_bytes AS imageSizeBytes,
            di.status, di.staff_response_notes AS staffResponseNotes,
            di.email_status AS emailStatus, di.email_error AS emailError,
            di.email_sent_at AS emailSentAt, di.created_at AS createdAt, di.updated_at AS updatedAt,
            u.full_name AS reviewedByName
       FROM doctor_inquiries di
       LEFT JOIN users u ON di.reviewed_by_user_id = u.id
      WHERE di.id = ?
      LIMIT 1`,
    [id]
  );

  if (!inquiries || inquiries.length === 0) {
    throw ApiError.notFound('Inquiry record not found');
  }

  const inquiry = inquiries[0];

  // Get line items
  const items = await query(
    `SELECT dii.id, dii.item_name_raw AS itemNameRaw,
            dii.matched_medicine_id AS matchedMedicineId,
            dii.availability_status AS availabilityStatus,
            dii.available_quantity AS availableQuantity,
            dii.unit_price AS unitPrice, dii.notes,
            m.generic_name AS genericName, m.brand_name AS brandName,
            m.strength, df.name AS dosageForm,
            COALESCE((
              SELECT SUM(b.quantity_on_hand)
                FROM batches b
               WHERE b.medicine_id = m.id AND b.status = 'active' AND b.expiry_date > CURRENT_DATE
            ), 0) AS liveSaleableStock
       FROM doctor_inquiry_items dii
       LEFT JOIN medicines m ON dii.matched_medicine_id = m.id
       LEFT JOIN dosage_forms df ON m.dosage_form_id = df.id
      WHERE dii.inquiry_id = ?
      ORDER BY dii.id ASC`,
    [id]
  );

  // Get email delivery logs
  const emailLogs = await query(
    `SELECT id, recipient_email AS recipientEmail, subject, status,
            error_message AS errorMessage, attempt_count AS attemptCount, created_at AS createdAt
       FROM email_logs
      WHERE inquiry_id = ?
      ORDER BY created_at DESC`,
    [id]
  );

  return {
    ...inquiry,
    hasImage: Boolean(inquiry.imageFilename),
    items: items || [],
    emailLogs: emailLogs || [],
  };
}

export async function saveInquiryItems(inquiryId, items, userId) {
  const existing = await query('SELECT id, status FROM doctor_inquiries WHERE id = ?', [inquiryId]);
  if (!existing || existing.length === 0) {
    throw ApiError.notFound('Inquiry not found');
  }

  // Delete previous items and insert refreshed list
  await query('DELETE FROM doctor_inquiry_items WHERE inquiry_id = ?', [inquiryId]);

  if (Array.isArray(items) && items.length > 0) {
    for (const item of items) {
      let liveStock = 0;
      let unitPrice = item.unitPrice || null;

      if (item.matchedMedicineId) {
        const stockRows = await query(
          `SELECT COALESCE(SUM(b.quantity_on_hand), 0) AS totalStock,
                  COALESCE(MIN(b.selling_price), 0) AS minPrice
             FROM batches b
            WHERE b.medicine_id = ? AND b.status = 'active' AND b.expiry_date > CURRENT_DATE`,
          [item.matchedMedicineId]
        );
        liveStock = stockRows[0]?.totalStock || 0;
        if (!unitPrice && stockRows[0]?.minPrice > 0) {
          unitPrice = stockRows[0].minPrice;
        }
      }

      await query(
        `INSERT INTO doctor_inquiry_items
         (inquiry_id, item_name_raw, matched_medicine_id, availability_status, available_quantity, unit_price, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          inquiryId,
          item.itemNameRaw || 'Unidentified Medicine',
          item.matchedMedicineId || null,
          item.availabilityStatus || (liveStock > 0 ? 'available' : 'out_of_stock'),
          item.availableQuantity !== undefined ? item.availableQuantity : liveStock,
          unitPrice,
          item.notes || null,
        ]
      );
    }
  }

  // Update status to in_review if it was pending
  if (existing[0].status === 'pending') {
    await query(
      'UPDATE doctor_inquiries SET status = "in_review", reviewed_by_user_id = ? WHERE id = ?',
      [userId, inquiryId]
    );
  }

  return getInquiryById(inquiryId);
}

export async function respondToInquiry(inquiryId, { responseNotes, items }, userId) {
  // First persist items if passed
  if (Array.isArray(items)) {
    await saveInquiryItems(inquiryId, items, userId);
  }

  const [inquiryRows, itemRows] = await Promise.all([
    query('SELECT * FROM doctor_inquiries WHERE id = ?', [inquiryId]),
    query('SELECT * FROM doctor_inquiry_items WHERE inquiry_id = ?', [inquiryId]),
  ]);

  if (!inquiryRows || inquiryRows.length === 0) {
    throw ApiError.notFound('Inquiry not found');
  }

  const inquiry = inquiryRows[0];

  // Update response notes & status
  await query(
    `UPDATE doctor_inquiries
        SET staff_response_notes = ?,
            status = 'responded',
            reviewed_by_user_id = ?
      WHERE id = ?`,
    [responseNotes || null, userId, inquiryId]
  );

  // Send email response with live stock status
  const emailResult = await emailService.sendAvailabilityResponse(inquiry, itemRows, responseNotes);

  // Audit log
  await logAudit({
    userId,
    action: 'INQUIRY_RESPONDED',
    tableName: 'doctor_inquiries',
    recordId: inquiryId,
    details: {
      referenceNo: inquiry.reference_no,
      itemCount: itemRows.length,
      emailSent: emailResult.success,
    },
  });

  return getInquiryById(inquiryId);
}

export async function retryEmailResponse(inquiryId, userId) {
  const result = await emailService.retryEmail(inquiryId);

  await logAudit({
    userId,
    action: 'INQUIRY_EMAIL_RETRY',
    tableName: 'doctor_inquiries',
    recordId: inquiryId,
    details: { result },
  });

  return result;
}

export default {
  createInquiry,
  getInquiries,
  getInquiryById,
  saveInquiryItems,
  respondToInquiry,
  retryEmailResponse,
};
