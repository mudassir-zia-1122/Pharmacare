import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import prescriptionService from '../services/prescription.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PRESCRIPTION_UPLOAD_DIR = path.resolve(__dirname, '../../uploads/prescriptions');

export const listPrescriptions = asyncHandler(async (req, res) => {
  const { status, search, page, limit } = req.query;
  const result = await prescriptionService.getPrescriptions({ status, search, page, limit }, req.user);
  return ApiResponse.paginate(res, result.items, result.pagination, 'Prescriptions retrieved');
});

export const getPrescription = asyncHandler(async (req, res) => {
  const prescription = await prescriptionService.getPrescriptionById(req.params.id, req.user);
  return ApiResponse.success(res, prescription, 'Prescription details retrieved');
});

export const createPrescription = asyncHandler(async (req, res) => {
  const prescription = await prescriptionService.createPrescription(req.body, req.user);
  return ApiResponse.created(res, prescription, 'Prescription created successfully');
});

export const verifyPrescription = asyncHandler(async (req, res) => {
  const { status, notes } = req.body || {};
  const result = await prescriptionService.verifyPrescription(req.params.id, req.user.id, { status, notes });
  return ApiResponse.success(res, result, 'Prescription status updated');
});

export const streamPrescriptionFile = asyncHandler(async (req, res) => {
  const requested = req.params.filename || '';
  const safeFilename = path.basename(requested);
  if (!safeFilename || safeFilename !== requested) {
    throw ApiError.badRequest('Invalid prescription filename');
  }

  const filePath = path.resolve(PRESCRIPTION_UPLOAD_DIR, safeFilename);
  if (!filePath.startsWith(PRESCRIPTION_UPLOAD_DIR + path.sep) || !fs.existsSync(filePath)) {
    throw ApiError.notFound('Prescription file not found');
  }

  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Content-Disposition', `inline; filename="${safeFilename.replace(/["\r\n]/g, '')}"`);
  return res.sendFile(filePath);
});

export default {
  listPrescriptions,
  getPrescription,
  createPrescription,
  verifyPrescription,
  streamPrescriptionFile,
};
