import prescriptionService from '../services/prescription.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';
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

export default {
  listPrescriptions,
  getPrescription,
  createPrescription,
  verifyPrescription,
};
