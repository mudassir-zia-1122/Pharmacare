import path from 'path';
import fs from 'fs';
import inquiryService from '../services/inquiry.service.js';
import emailService from '../services/email.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const submitInquiry = asyncHandler(async (req, res) => {
  const result = await inquiryService.createInquiry(req.body, req.file);
  return ApiResponse.created(res, result, 'Medicine availability inquiry submitted successfully');
});

export const listInquiries = asyncHandler(async (req, res) => {
  const { status, search, page, limit } = req.query;
  const result = await inquiryService.getInquiries({ status, search, page, limit });
  return ApiResponse.paginate(res, result.items, result.pagination, 'Inquiries retrieved');
});

export const getInquiry = asyncHandler(async (req, res) => {
  const inquiry = await inquiryService.getInquiryById(req.params.id);
  return ApiResponse.success(res, inquiry, 'Inquiry details retrieved');
});

export const streamInquiryImage = asyncHandler(async (req, res) => {
  const inquiry = await inquiryService.getInquiryById(req.params.id);
  if (!inquiry.imageFilename) {
    throw ApiError.notFound('No prescription image attached to this inquiry');
  }

  const uploadDir = path.resolve('backend/uploads/prescriptions');
  const filePath = path.join(uploadDir, inquiry.imageFilename);

  // Directory traversal check
  if (!filePath.startsWith(uploadDir) || !fs.existsSync(filePath)) {
    throw ApiError.notFound('Prescription file does not exist on disk');
  }

  res.setHeader('Content-Type', inquiry.imageMimeType || 'image/jpeg');
  res.setHeader('Content-Disposition', `inline; filename="${inquiry.imageOriginalName || 'prescription'}"`);
  return res.sendFile(filePath);
});

export const saveItems = asyncHandler(async (req, res) => {
  const { items } = req.body;
  const result = await inquiryService.saveInquiryItems(req.params.id, items, req.user.id);
  return ApiResponse.success(res, result, 'Inquiry line items saved successfully');
});

export const respond = asyncHandler(async (req, res) => {
  const { responseNotes, items } = req.body;
  const result = await inquiryService.respondToInquiry(req.params.id, { responseNotes, items }, req.user.id);
  return ApiResponse.success(res, result, 'Availability response dispatched to doctor email');
});

export const retryEmail = asyncHandler(async (req, res) => {
  const result = await inquiryService.retryEmailResponse(req.params.id, req.user.id);
  return ApiResponse.success(res, result, 'Email retry attempt executed');
});

export const getSmtpStatus = asyncHandler(async (req, res) => {
  const config = emailService.getSmtpConfigStatus();
  const connection = await emailService.verifyConnection();
  return ApiResponse.success(res, { config, connection }, 'SMTP configuration status');
});

export const sendTestEmail = asyncHandler(async (req, res) => {
  const { recipientEmail } = req.body;
  if (!recipientEmail) {
    throw ApiError.badRequest('Recipient email is required');
  }
  const result = await emailService.sendTestEmail(recipientEmail);
  return ApiResponse.success(res, result, 'Test email dispatched');
});

export default {
  submitInquiry,
  listInquiries,
  getInquiry,
  streamInquiryImage,
  saveItems,
  respond,
  retryEmail,
  getSmtpStatus,
  sendTestEmail,
};
