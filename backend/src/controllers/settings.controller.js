import settingsService from '../services/settings.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getSettings = asyncHandler(async (req, res) => {
  const settings = await settingsService.getAllSettings();
  return ApiResponse.success(res, settings, 'Pharmacy settings retrieved');
});

export const updateSettings = asyncHandler(async (req, res) => {
  const updated = await settingsService.updateSettings(req.body, req.user.id);
  return ApiResponse.success(res, updated, 'Pharmacy settings updated');
});

export const listCurrencies = asyncHandler(async (req, res) => {
  const currencies = await settingsService.getCurrencies();
  return ApiResponse.success(res, currencies, 'Currencies retrieved');
});

export const listTaxRules = asyncHandler(async (req, res) => {
  const taxRules = await settingsService.getTaxRules();
  return ApiResponse.success(res, taxRules, 'Tax rules retrieved');
});

export const listSuppliers = asyncHandler(async (req, res) => {
  const suppliers = await settingsService.getSuppliers();
  return ApiResponse.success(res, suppliers, 'Suppliers directory retrieved');
});

export const createSupplier = asyncHandler(async (req, res) => {
  const supplier = await settingsService.createSupplier(req.body, req.user?.id);
  return ApiResponse.created(res, supplier, 'Supplier created successfully');
});

export const updateSupplier = asyncHandler(async (req, res) => {
  const supplier = await settingsService.updateSupplier(req.params.id, req.body, req.user?.id);
  return ApiResponse.success(res, supplier, 'Supplier updated successfully');
});

export const deleteSupplier = asyncHandler(async (req, res) => {
  const result = await settingsService.deleteSupplier(req.params.id, req.user?.id);
  return ApiResponse.success(res, result, result.message || 'Supplier deleted successfully');
});

export const listCustomers = asyncHandler(async (req, res) => {
  const { search, limit } = req.query;
  const customers = await settingsService.getCustomers({ search, limit });
  return ApiResponse.success(res, customers, 'Customers retrieved');
});

export default {
  getSettings,
  updateSettings,
  listCurrencies,
  listTaxRules,
  listSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  listCustomers,
};
