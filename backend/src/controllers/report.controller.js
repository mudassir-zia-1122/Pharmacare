import reportService from '../services/report.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getSalesReport = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  const report = await reportService.getSalesReport({ startDate, endDate });
  return ApiResponse.success(res, report, 'Sales report generated');
});

export const getStockValuation = asyncHandler(async (req, res) => {
  const valuation = await reportService.getStockValuationReport();
  return ApiResponse.success(res, valuation, 'Stock valuation report generated');
});

export const getLowStockReport = asyncHandler(async (req, res) => {
  const lowStock = await reportService.getLowStockReport();
  return ApiResponse.success(res, lowStock, 'Low stock alerts retrieved');
});

export const getNearExpiryReport = asyncHandler(async (req, res) => {
  const nearExpiry = await reportService.getNearExpiryReport();
  return ApiResponse.success(res, nearExpiry, 'Near expiry batches retrieved');
});

export const getDepartmentPrescriptions = asyncHandler(async (req, res) => {
  const data = await reportService.getDepartmentPrescriptionReport();
  return ApiResponse.success(res, data, 'Department prescription statistics retrieved');
});

export const getProfitLossReport = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  const data = await reportService.getProfitLossReport({ startDate, endDate });
  return ApiResponse.success(res, data, 'Profit and loss report generated');
});

export default {
  getSalesReport,
  getStockValuation,
  getLowStockReport,
  getNearExpiryReport,
  getDepartmentPrescriptions,
  getProfitLossReport,
};
