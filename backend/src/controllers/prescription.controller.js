import path from 'path';
import prescriptionService from '../services/prescription.service.js';
import storageService from '../services/storage.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

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
  const storageKey = req.query.key || req.params.filename || '';
  if (!storageKey) {
    throw ApiError.badRequest('Prescription file identifier is required');
  }

  const fileAsset = await storageService.getPrivatePrescriptionStream(storageKey);
  const displayName = path.basename(storageKey.replace(/^r2:\/\//, '')).replace(/["\r\n]/g, '');

  if (fileAsset.contentType) {
    res.setHeader('Content-Type', fileAsset.contentType);
  }
  if (fileAsset.contentLength) {
    res.setHeader('Content-Length', String(fileAsset.contentLength));
  }
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Content-Disposition', `inline; filename="${displayName || 'prescription'}"`);

  fileAsset.stream.on('error', (err) => {
    if (!res.headersSent) {
      res.status(502).json({ success: false, message: 'Failed to stream private prescription file.' });
    } else {
      res.destroy(err);
    }
  });

  return fileAsset.stream.pipe(res);
});

export const getPrescriptionSignedUrl = asyncHandler(async (req, res) => {
  const storageKey = req.query.key || '';
  const signed = await storageService.getPrivatePrescriptionSignedUrl(storageKey);
  return ApiResponse.success(res, signed, 'Short-lived signed prescription URL generated');
});

export default {
  listPrescriptions,
  getPrescription,
  createPrescription,
  verifyPrescription,
  streamPrescriptionFile,
  getPrescriptionSignedUrl,
};
