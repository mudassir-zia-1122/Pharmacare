import dashboardService from '../services/dashboard.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getSummary = asyncHandler(async (req, res) => {
  const summary = await dashboardService.getDashboardSummary();
  return ApiResponse.success(res, summary, 'Dashboard summary metrics retrieved');
});

export default {
  getSummary,
};
