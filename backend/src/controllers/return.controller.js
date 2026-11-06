import returnService from '../services/return.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const listReturns = asyncHandler(async (req, res) => {
  const { type, search, page, limit } = req.query;
  const result = await returnService.getReturns({ type, search, page, limit });
  return ApiResponse.paginate(res, result.items, result.pagination, 'Returns retrieved');
});

export const createSaleReturn = asyncHandler(async (req, res) => {
  const result = await returnService.processSaleReturn(req.body, req.user.id);
  return ApiResponse.created(res, result, 'Return processed successfully');
});

export default {
  listReturns,
  createSaleReturn,
};
