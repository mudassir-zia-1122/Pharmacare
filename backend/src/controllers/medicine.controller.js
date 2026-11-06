import medicineService from '../services/medicine.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const listMedicines = asyncHandler(async (req, res) => {
  const { search, category, dosageForm, status, page, limit } = req.query;
  const result = await medicineService.getMedicines({ search, category, dosageForm, status, page, limit });
  return ApiResponse.paginate(res, result.items, result.pagination, 'Medicines retrieved');
});

export const getMedicine = asyncHandler(async (req, res) => {
  const medicine = await medicineService.getMedicineById(req.params.id);
  return ApiResponse.success(res, medicine, 'Medicine details retrieved');
});

export const createMedicine = asyncHandler(async (req, res) => {
  const created = await medicineService.createMedicine(req.body, req.user.id);
  return ApiResponse.created(res, created, 'Medicine created successfully');
});

export const updateMedicine = asyncHandler(async (req, res) => {
  const updated = await medicineService.updateMedicine(req.params.id, req.body, req.user.id);
  return ApiResponse.success(res, updated, 'Medicine updated successfully');
});

export const updateMedicineStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const result = await medicineService.updateMedicineStatus(req.params.id, status, req.user.id);
  return ApiResponse.success(res, result, 'Medicine status updated successfully');
});

export const listCategories = asyncHandler(async (req, res) => {
  const categories = await medicineService.getCategories();
  return ApiResponse.success(res, categories, 'Categories retrieved');
});

export const createCategory = asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  const category = await medicineService.createCategory(name, description, req.user.id);
  return ApiResponse.created(res, category, 'Category created');
});

export const listDosageForms = asyncHandler(async (req, res) => {
  const forms = await medicineService.getDosageForms();
  return ApiResponse.success(res, forms, 'Dosage forms retrieved');
});

export const listManufacturers = asyncHandler(async (req, res) => {
  const mfgs = await medicineService.getManufacturers();
  return ApiResponse.success(res, mfgs, 'Manufacturers retrieved');
});

export const importMedicines = asyncHandler(async (req, res) => {
  const { rows } = req.body;
  const result = await medicineService.importMedicines(rows, req.user.id);
  return ApiResponse.success(res, result, 'Medicines imported successfully');
});

export default {
  listMedicines,
  getMedicine,
  createMedicine,
  updateMedicine,
  updateMedicineStatus,
  importMedicines,
  listCategories,
  createCategory,
  listDosageForms,
  listManufacturers,
};
