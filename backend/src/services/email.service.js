import nodemailer from 'nodemailer';
import { query } from '../config/db.js';

let transporter = null;

/**
 * Resolves the sender email address from environment variables.
 */
export function getFromAddress() {
  return process.env.EMAIL_FROM || process.env.SMTP_FROM || '"PharmaCare Clinical Pharmacy" <noreply@pharmacare.pk>';
}

/**
 * Resolves the internal pharmacy notification email address.
 */
export function getPharmacyNotificationEmail() {
  return process.env.PHARMACY_NOTIFICATION_EMAIL || 'dispensary@pharmacare.pk';
}

/**
 * Validates the SMTP configuration parameters without exposing sensitive secrets.
 */
export function validateSmtpConfig() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  const issues = [];
  if (!host) issues.push('SMTP_HOST is not defined');
  if (isNaN(port) || port <= 0 || port > 65535) issues.push(`Invalid SMTP_PORT: ${process.env.SMTP_PORT}`);
  if (user && !pass) issues.push('SMTP_USER is set but SMTP_PASS is missing');
  if (!user && pass) issues.push('SMTP_PASS is set but SMTP_USER is missing');

  return {
    isValid: issues.length === 0,
    issues,
  };
}

/**
 * Returns a sanitized configuration overview suitable for diagnostics.
 * Crucially omits passwords and tokens.
 */
export function getSmtpConfigStatus() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = process.env.SMTP_SECURE === 'true';
  const user = process.env.SMTP_USER || '';
  const pass = process.env.SMTP_PASS || '';
  const isConfigured = Boolean(user.trim() && pass.trim());

  // Mask user email for privacy (e.g. ad***@gmail.com)
  let maskedUser = null;
  if (user) {
    const atIdx = user.indexOf('@');
    if (atIdx > 2) {
      maskedUser = `${user.slice(0, 2)}***${user.slice(atIdx)}`;
    } else {
      maskedUser = '***configured***';
    }
  }

  return {
    configured: isConfigured,
    simulated: !isConfigured,
    host,
    port,
    secure,
    userConfigured: Boolean(user.trim()),
    userMasked: maskedUser,
    passConfigured: Boolean(pass.trim()),
    emailFrom: getFromAddress(),
    pharmacyNotificationEmail: getPharmacyNotificationEmail(),
  };
}

/**
 * Initializes or returns the cached Nodemailer transport.
 */
export function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = process.env.SMTP_SECURE === 'true';
  const user = (process.env.SMTP_USER || '').trim();
  const pass = (process.env.SMTP_PASS || '').trim();

  if (user && pass) {
    transporter = nodemailer.createTransport({
      host,
      port,
      secure, // false for port 587 (STARTTLS)
      requireTLS: port === 587,
      auth: { user, pass },
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
    });
  } else {
    // Simulated transporter in development when live SMTP credentials are not configured
    transporter = {
      isSimulated: true,
      sendMail: async (mailOptions) => {
        console.log(`[EMAIL SIMULATED] To: ${mailOptions.to} | Subject: ${mailOptions.subject}`);
        return {
          messageId: `simulated-${Date.now()}@pharmacare.pk`,
          response: '250 Message simulated in development environment (no SMTP credentials configured)',
        };
      },
      verify: async () => true,
    };
  }

  return transporter;
}

/**
 * Resets the cached transporter (useful when environment variables change or during testing).
 */
export function resetTransporter() {
  transporter = null;
}

/**
 * General-purpose email dispatcher.
 * @param {Object} options - { to, subject, text, html, attachments }
 */
export async function sendEmail({ to, subject, text, html, attachments = [] }) {
  if (!to) {
    throw new Error('Recipient address (to) is required');
  }

  const t = getTransporter();
  const from = getFromAddress();

  try {
    const result = await t.sendMail({
      from,
      to,
      subject,
      text,
      html,
      attachments,
    });

    return {
      success: true,
      messageId: result.messageId,
      simulated: Boolean(t.isSimulated),
      recipient: to,
    };
  } catch (err) {
    console.error('[EMAIL ERROR] sendEmail failed:', err.message);
    return {
      success: false,
      error: err.message,
      simulated: false,
      recipient: to,
    };
  }
}

/**
 * Send administrative system alert to pharmacy administrators.
 * @param {string} subject - Alert subject
 * @param {string} message - Alert message body
 * @param {Object} details - Optional key-value metadata
 */
export async function sendAdminNotification(subject, message, details = {}) {
  const adminEmail = getPharmacyNotificationEmail();
  const fullSubject = `[PharmaCare Admin Alert] ${subject}`;

  const detailEntries = Object.entries(details)
    .map(([key, val]) => `• ${key}: ${typeof val === 'object' ? JSON.stringify(val) : val}`)
    .join('\n');

  const text = `${message}\n\nTimestamp: ${new Date().toLocaleString()}\n${detailEntries ? `\nDetails:\n${detailEntries}\n` : ''}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background-color: #ffffff;">
      <div style="background-color: #0f172a; padding: 18px; text-align: center; color: white;">
        <h2 style="margin: 0; font-size: 18px;">PharmaCare Administrative Alert</h2>
      </div>
      <div style="padding: 24px; color: #1e293b; line-height: 1.5;">
        <p style="font-size: 14px; font-weight: bold; margin-top: 0;">${message}</p>
        <p style="font-size: 12px; color: #64748b;">Triggered at: ${new Date().toLocaleString()}</p>
        ${
          detailEntries
            ? `<div style="background-color: #f8fafc; border-left: 4px solid #0f172a; padding: 12px; margin: 16px 0; font-size: 12px; font-family: monospace;">
                ${Object.entries(details)
                  .map(([k, v]) => `<div><strong>${k}:</strong> ${typeof v === 'object' ? JSON.stringify(v) : v}</div>`)
                  .join('')}
              </div>`
            : ''
        }
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="font-size: 11px; color: #94a3b8; margin: 0;">System notification sent to: ${adminEmail}</p>
      </div>
    </div>
  `;

  return sendEmail({
    to: adminEmail,
    subject: fullSubject,
    text,
    html,
  });
}

/**
 * Send internal notification email to pharmacy staff when a new prescription inquiry arrives.
 * (Alias matching user-requested naming convention)
 */
export async function sendPrescriptionInquiryNotification(inquiry) {
  return sendPharmacyNewInquiryNotification(inquiry);
}
export async function verifyConnection() {
  const t = getTransporter();

  if (t.isSimulated) {
    return {
      success: true,
      simulated: true,
      message: 'SMTP is running in development simulation mode. Provide SMTP_USER and SMTP_PASS in backend/.env for live delivery.',
    };
  }

  try {
    await t.verify();
    return {
      success: true,
      simulated: false,
      message: `SMTP connection to ${process.env.SMTP_HOST}:${process.env.SMTP_PORT} verified successfully.`,
    };
  } catch (err) {
    console.error('[SMTP VERIFICATION ERROR]', err.message);
    return {
      success: false,
      simulated: false,
      error: err.message,
    };
  }
}

/**
 * Send inquiry confirmation email to doctor/clinic.
 */
export async function sendInquiryConfirmation(inquiry) {
  const t = getTransporter();
  const from = getFromAddress();
  const subject = `[PharmaCare] Inquiry Received: Ref ${inquiry.reference_no}`;

  const bodyText = `Dear Dr. ${inquiry.doctor_name},

Thank you for contacting PharmaCare Pharmacy. We have received your medicine availability inquiry.

Reference Number: ${inquiry.reference_no}
Clinic/Hospital: ${inquiry.clinic_hospital_name}
Date Submitted: ${new Date().toLocaleString()}

Our pharmacy clinical team is currently reviewing your uploaded prescription/medicine request against our active, saleable batch inventory (FEFO).

You will receive an official availability response shortly with batch-verified stock status and pricing.

Sincerely,
PharmaCare Clinical Pharmacy Operations Team
Tel: +92 21 34567890 | Web: pharmacare.pk`;

  const bodyHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background-color: #ffffff;">
      <div style="background-color: #16a34a; padding: 20px; text-align: center; color: white;">
        <h2 style="margin: 0; font-size: 22px;">PharmaCare Clinical Pharmacy</h2>
        <p style="margin: 5px 0 0; font-size: 14px; opacity: 0.95;">Medicine Availability Inquiry Confirmation</p>
      </div>
      <div style="padding: 24px; color: #1e293b; line-height: 1.5;">
        <p>Dear <strong>Dr. ${inquiry.doctor_name}</strong> (${inquiry.clinic_hospital_name}),</p>
        <p>We have successfully received your medicine availability inquiry.</p>
        <div style="background-color: #f8fafc; border-left: 4px solid #16a34a; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
          <p style="margin: 0; font-size: 14px;"><strong>Reference Number:</strong> <span style="font-family: monospace; color: #16a34a; font-weight: bold; font-size: 15px;">${inquiry.reference_no}</span></p>
          <p style="margin: 4px 0 0; font-size: 13px; color: #64748b;">Submitted on: ${new Date().toLocaleString()}</p>
        </div>
        <p>Our licensed pharmacists are inspecting your request and verifying actual saleable stock according to First-Expiry-First-Out (FEFO) safety standards.</p>
        <p>You will receive an itemized email breakdown as soon as verification is complete.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="font-size: 12px; color: #94a3b8; margin: 0;">This is an automated notification from PharmaCare Pharmacy Management System. Please do not reply directly to this message.</p>
      </div>
    </div>
  `;

  try {
    const result = await t.sendMail({
      from,
      to: inquiry.email,
      subject,
      text: bodyText,
      html: bodyHtml,
    });

    await query(
      `INSERT INTO email_logs (inquiry_id, recipient_email, subject, body_text, status, error_message, attempt_count)
       VALUES (?, ?, ?, ?, 'sent', NULL, 1)`,
      [inquiry.id, inquiry.email, subject, bodyText]
    );

    return { success: true, messageId: result.messageId, simulated: Boolean(t.isSimulated) };
  } catch (err) {
    console.error('[EMAIL ERROR] Confirmation failed:', err.message);

    await query(
      `INSERT INTO email_logs (inquiry_id, recipient_email, subject, body_text, status, error_message, attempt_count)
       VALUES (?, ?, ?, ?, 'failed', ?, 1)`,
      [inquiry.id, inquiry.email, subject, bodyText, err.message]
    );

    return { success: false, error: err.message, simulated: false };
  }
}

/**
 * Send internal notification email to pharmacy staff when a new doctor inquiry is received.
 */
export async function sendPharmacyNewInquiryNotification(inquiry) {
  const t = getTransporter();
  const from = getFromAddress();
  const pharmacyEmail = getPharmacyNotificationEmail();
  const subject = `[PharmaCare Alert] New Medicine Availability Inquiry: Ref ${inquiry.reference_no}`;

  const notesExcerpt = inquiry.manual_notes ? inquiry.manual_notes.slice(0, 300) : 'None provided';
  const hasAttachment = Boolean(inquiry.has_image || inquiry.image_filename);

  const bodyText = `PharmaCare Dispensary Alert - New Doctor Inquiry

A new medicine availability inquiry has been submitted and is awaiting staff review.

Reference Number: ${inquiry.reference_no}
Doctor Name: Dr. ${inquiry.doctor_name}
Clinic / Hospital: ${inquiry.clinic_hospital_name}
Contact Email: ${inquiry.email}
Contact Phone: ${inquiry.phone || 'Not provided'}
Prescription Image: ${hasAttachment ? 'Yes (Uploaded)' : 'No (Text-only request)'}

Doctor Notes:
${notesExcerpt}

Action Required:
Log in to the PharmaCare Staff Portal to review the inquiry, inspect the prescription image, and match medicines against active batch inventory (FEFO):
Portal URL: http://localhost:5173/inquiries

PharmaCare Pharmacy Management System`;

  const bodyHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background-color: #ffffff;">
      <div style="background-color: #0f766e; padding: 20px; text-align: center; color: white;">
        <h2 style="margin: 0; font-size: 22px;">PharmaCare Clinical Dispensary</h2>
        <p style="margin: 5px 0 0; font-size: 14px; opacity: 0.95;">Internal Alert: New Doctor Inquiry Awaiting Review</p>
      </div>
      <div style="padding: 24px; color: #1e293b; line-height: 1.5;">
        <p>A new medicine availability inquiry has been submitted by a healthcare practitioner.</p>

        <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px;">
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 8px 0; color: #64748b; width: 140px;"><strong>Reference:</strong></td>
            <td style="padding: 8px 0; font-family: monospace; font-weight: bold; color: #0f766e;">${inquiry.reference_no}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 8px 0; color: #64748b;"><strong>Doctor:</strong></td>
            <td style="padding: 8px 0;">Dr. ${inquiry.doctor_name}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 8px 0; color: #64748b;"><strong>Clinic / Hospital:</strong></td>
            <td style="padding: 8px 0;">${inquiry.clinic_hospital_name}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 8px 0; color: #64748b;"><strong>Doctor Email:</strong></td>
            <td style="padding: 8px 0;">${inquiry.email}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 8px 0; color: #64748b;"><strong>Doctor Phone:</strong></td>
            <td style="padding: 8px 0;">${inquiry.phone || 'Not provided'}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 8px 0; color: #64748b;"><strong>Prescription File:</strong></td>
            <td style="padding: 8px 0;">${hasAttachment ? '<span style="color: #16a34a; font-weight: bold;">✔ Uploaded</span>' : '<span style="color: #64748b;">Text-only</span>'}</td>
          </tr>
        </table>

        ${inquiry.manual_notes ? `
          <div style="background-color: #f8fafc; border-left: 4px solid #0f766e; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
            <p style="margin: 0; font-size: 12px; font-weight: bold; color: #475569;">Inquiry Notes / Requested Items:</p>
            <p style="margin: 4px 0 0; font-size: 13px; color: #334155; white-space: pre-wrap;">${notesExcerpt}</p>
          </div>
        ` : ''}

        <div style="text-align: center; margin: 24px 0;">
          <p style="margin: 0 0 12px 0; font-size: 13px; color: #64748b;">Please open the dispensary portal to match medicines and respond:</p>
          <a href="http://localhost:5173/inquiries" style="display: inline-block; background-color: #0f766e; color: #ffffff; text-decoration: none; font-weight: bold; padding: 10px 20px; border-radius: 6px; font-size: 14px;">Open Staff Inquiries Portal</a>
        </div>

        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="font-size: 12px; color: #94a3b8; margin: 0;">Automated dispensary notification from PharmaCare System.</p>
      </div>
    </div>
  `;

  try {
    const result = await t.sendMail({
      from,
      to: pharmacyEmail,
      subject,
      text: bodyText,
      html: bodyHtml,
    });

    await query(
      `INSERT INTO email_logs (inquiry_id, recipient_email, subject, body_text, status, error_message, attempt_count)
       VALUES (?, ?, ?, ?, 'sent', NULL, 1)`,
      [inquiry.id, pharmacyEmail, subject, bodyText]
    );

    return { success: true, messageId: result.messageId, simulated: Boolean(t.isSimulated) };
  } catch (err) {
    console.error('[EMAIL ERROR] Pharmacy alert failed:', err.message);

    await query(
      `INSERT INTO email_logs (inquiry_id, recipient_email, subject, body_text, status, error_message, attempt_count)
       VALUES (?, ?, ?, ?, 'failed', ?, 1)`,
      [inquiry.id, pharmacyEmail, subject, bodyText, err.message]
    );

    return { success: false, error: err.message, simulated: false };
  }
}

/**
 * Send verified availability response to doctor/clinic.
 */
export async function sendAvailabilityResponse(inquiry, items, staffNotes) {
  const t = getTransporter();
  const from = getFromAddress();
  const subject = `[PharmaCare] Medicine Availability Response: Ref ${inquiry.reference_no}`;

  let itemsText = items.map((it, idx) =>
    `${idx + 1}. ${it.item_name_raw} - Status: ${it.availability_status.toUpperCase()} | Qty Available: ${it.available_quantity} | Notes: ${it.notes || 'None'}`
  ).join('\n');

  const bodyText = `Dear Dr. ${inquiry.doctor_name},

Our pharmacy clinical team has reviewed your inquiry (Reference: ${inquiry.reference_no}).
Below is our verified stock availability based on live batch inventory:

${itemsText}

Pharmacist Notes:
${staffNotes || 'All available medicines have been verified for valid expiry and DRAP compliance.'}

For order placement or reservations, please contact our dispensing counter at +92 21 34567890.

Sincerely,
PharmaCare Clinical Pharmacy Operations`;

  // HTML Table Rows
  const itemsHtml = items.map((it) => {
    let statusBadge = '';
    if (it.availability_status === 'available') {
      statusBadge = '<span style="color: #16a34a; font-weight: bold;">● Available</span>';
    } else if (it.availability_status === 'partially_available') {
      statusBadge = '<span style="color: #d97706; font-weight: bold;">▲ Partially Available</span>';
    } else if (it.availability_status === 'out_of_stock') {
      statusBadge = '<span style="color: #dc2626; font-weight: bold;">✕ Out of Stock</span>';
    } else {
      statusBadge = '<span style="color: #64748b; font-weight: bold;">? Needs Clarification</span>';
    }

    return `
      <tr style="border-bottom: 1px solid #f1f5f9;">
        <td style="padding: 10px; font-size: 13px;">${it.item_name_raw}</td>
        <td style="padding: 10px; font-size: 13px;">${statusBadge}</td>
        <td style="padding: 10px; font-size: 13px; text-align: center;">${it.available_quantity}</td>
        <td style="padding: 10px; font-size: 12px; color: #64748b;">${it.notes || '-'}</td>
      </tr>
    `;
  }).join('');

  const bodyHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background-color: #ffffff;">
      <div style="background-color: #16a34a; padding: 20px; text-align: center; color: white;">
        <h2 style="margin: 0; font-size: 22px;">PharmaCare Clinical Pharmacy</h2>
        <p style="margin: 5px 0 0; font-size: 14px; opacity: 0.95;">Stock Availability & Quotation Response</p>
      </div>
      <div style="padding: 24px; color: #1e293b; line-height: 1.5;">
        <p>Dear <strong>Dr. ${inquiry.doctor_name}</strong> (${inquiry.clinic_hospital_name}),</p>
        <p>Our pharmacists have inspected your prescription request (Reference: <strong style="font-family: monospace; color: #16a34a;">${inquiry.reference_no}</strong>). Here is the verified availability report:</p>

        <table style="width: 100%; border-collapse: collapse; margin: 16px 0; text-align: left;">
          <thead>
            <tr style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0;">
              <th style="padding: 10px; font-size: 12px; text-transform: uppercase; color: #64748b;">Requested Medicine</th>
              <th style="padding: 10px; font-size: 12px; text-transform: uppercase; color: #64748b;">Status</th>
              <th style="padding: 10px; font-size: 12px; text-transform: uppercase; color: #64748b; text-align: center;">Qty</th>
              <th style="padding: 10px; font-size: 12px; text-transform: uppercase; color: #64748b;">Pharmacist Remarks</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        ${staffNotes ? `
          <div style="background-color: #f1f5f9; border-radius: 6px; padding: 12px; margin-top: 16px;">
            <p style="margin: 0; font-size: 12px; font-weight: bold; color: #475569;">Additional Notes from Pharmacist:</p>
            <p style="margin: 4px 0 0; font-size: 13px; color: #334155;">${staffNotes}</p>
          </div>
        ` : ''}

        <p style="margin-top: 24px; font-size: 13px;">To reserve or arrange immediate dispatch of available medicines, please contact our dispensing helpline at <strong>+92 21 34567890</strong> or email <strong>orders@pharmacare.pk</strong>.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="font-size: 11px; color: #94a3b8; margin: 0;">Stock is verified dynamically against active non-expired batches according to FEFO protocols.</p>
      </div>
    </div>
  `;

  try {
    const result = await t.sendMail({
      from,
      to: inquiry.email,
      subject,
      text: bodyText,
      html: bodyHtml,
    });

    await query(
      `INSERT INTO email_logs (inquiry_id, recipient_email, subject, body_text, status, error_message, attempt_count)
       VALUES (?, ?, ?, ?, 'sent', NULL, 1)`,
      [inquiry.id, inquiry.email, subject, bodyText]
    );

    await query(
      `UPDATE doctor_inquiries
          SET email_status = 'sent', email_error = NULL, email_sent_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
      [inquiry.id]
    );

    return { success: true, messageId: result.messageId, simulated: Boolean(t.isSimulated) };
  } catch (err) {
    console.error('[EMAIL ERROR] Availability response failed:', err.message);

    await query(
      `INSERT INTO email_logs (inquiry_id, recipient_email, subject, body_text, status, error_message, attempt_count)
       VALUES (?, ?, ?, ?, 'failed', ?, 1)`,
      [inquiry.id, inquiry.email, subject, bodyText, err.message]
    );

    await query(
      `UPDATE doctor_inquiries
          SET email_status = 'failed', email_error = ?
        WHERE id = ?`,
      [err.message, inquiry.id]
    );

    return { success: false, error: err.message, simulated: false };
  }
}

/**
 * Retry sending a failed email.
 */
export async function retryEmail(inquiryId) {
  const [inquiries, items] = await Promise.all([
    query('SELECT * FROM doctor_inquiries WHERE id = ?', [inquiryId]),
    query('SELECT * FROM doctor_inquiry_items WHERE inquiry_id = ?', [inquiryId]),
  ]);

  if (!inquiries || inquiries.length === 0) {
    throw new Error('Inquiry not found');
  }

  const inquiry = inquiries[0];
  return sendAvailabilityResponse(inquiry, items, inquiry.staff_response_notes);
}

/**
 * Send an explicit test email to verify SMTP configuration and delivery.
 */
export async function sendTestEmail(recipientEmail) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!recipientEmail || !emailRegex.test(recipientEmail.trim())) {
    throw new Error('Valid recipient email address is required');
  }

  const t = getTransporter();
  const from = getFromAddress();
  const subject = '[PharmaCare] SMTP Test Email';
  const timestamp = new Date().toLocaleString();

  const bodyText = `PharmaCare SMTP Verification Test

This is an automated test email sent from the PharmaCare Pharmacy Management System.

Sent At: ${timestamp}
Transporter Status: ${t.isSimulated ? 'Simulated Development Mode' : 'Live SMTP Transporter'}
Host: ${process.env.SMTP_HOST || 'localhost'}
Port: ${process.env.SMTP_PORT || '587'}
From: ${from}

If you received this message, your SMTP email configuration is functioning properly.`;

  const bodyHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background-color: #ffffff;">
      <div style="background-color: #16a34a; padding: 18px; text-align: center; color: white;">
        <h2 style="margin: 0; font-size: 20px;">PharmaCare SMTP Test Verification</h2>
      </div>
      <div style="padding: 24px; color: #1e293b; line-height: 1.5;">
        <p>This is a verification test message from the <strong>PharmaCare Pharmacy Management System</strong>.</p>
        <div style="background-color: #f8fafc; border-left: 4px solid #16a34a; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
          <p style="margin: 0; font-size: 13px;"><strong>Delivery Status:</strong> ${t.isSimulated ? '<span style="color: #d97706; font-weight: bold;">Simulated Development Mode</span>' : '<span style="color: #16a34a; font-weight: bold;">Live SMTP Delivery</span>'}</p>
          <p style="margin: 4px 0 0; font-size: 13px;"><strong>Timestamp:</strong> ${timestamp}</p>
          <p style="margin: 4px 0 0; font-size: 13px;"><strong>Sender Address:</strong> ${from}</p>
        </div>
        <p style="font-size: 13px; color: #64748b;">If you are seeing this email, your Nodemailer transporter configuration has been established successfully.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="font-size: 11px; color: #94a3b8; margin: 0;">Automated test dispatch from PharmaCare Diagnostic Suite.</p>
      </div>
    </div>
  `;

  try {
    const result = await t.sendMail({
      from,
      to: recipientEmail.trim(),
      subject,
      text: bodyText,
      html: bodyHtml,
    });

    await query(
      `INSERT INTO email_logs (inquiry_id, recipient_email, subject, body_text, status, error_message, attempt_count)
       VALUES (NULL, ?, ?, ?, 'sent', NULL, 1)`,
      [recipientEmail.trim(), subject, bodyText]
    );

    return {
      success: true,
      messageId: result.messageId,
      simulated: Boolean(t.isSimulated),
      recipient: recipientEmail.trim(),
    };
  } catch (err) {
    console.error('[EMAIL ERROR] Test email failed:', err.message);

    await query(
      `INSERT INTO email_logs (inquiry_id, recipient_email, subject, body_text, status, error_message, attempt_count)
       VALUES (NULL, ?, ?, ?, 'failed', ?, 1)`,
      [recipientEmail.trim(), subject, bodyText, err.message]
    );

    return {
      success: false,
      error: err.message,
      simulated: false,
      recipient: recipientEmail.trim(),
    };
  }
}

export default {
  getFromAddress,
  getPharmacyNotificationEmail,
  validateSmtpConfig,
  getSmtpConfigStatus,
  getTransporter,
  resetTransporter,
  verifyConnection,
  sendEmail,
  sendAdminNotification,
  sendPrescriptionInquiryNotification,
  sendInquiryConfirmation,
  sendPharmacyNewInquiryNotification,
  sendAvailabilityResponse,
  retryEmail,
  sendTestEmail,
};
