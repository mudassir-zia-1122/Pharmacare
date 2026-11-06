import posService from '../services/pos.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const searchMedicines = asyncHandler(async (req, res) => {
  const { q } = req.query;
  const results = await posService.searchMedicinesForPOS(q);
  return ApiResponse.success(res, results, 'POS search results');
});

export const checkout = asyncHandler(async (req, res) => {
  const result = await posService.processPOSCheckout(req.body, req.user.id);
  return ApiResponse.created(res, result, 'Sale completed successfully');
});

export const listSales = asyncHandler(async (req, res) => {
  const { search, status, page, limit } = req.query;
  const result = await posService.getSalesHistory({ search, status, page, limit });
  return ApiResponse.paginate(res, result.items, result.pagination, 'Sales history retrieved');
});

export const getSaleInvoice = asyncHandler(async (req, res) => {
  const invoice = await posService.getSaleInvoiceDetails(req.params.id);
  return ApiResponse.success(res, invoice, 'Invoice details retrieved');
});

export default {
  searchMedicines,
  checkout,
  listSales,
  getSaleInvoice,
};
