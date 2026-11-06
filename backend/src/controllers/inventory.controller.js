import inventoryService from '../services/inventory.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const listBatches = asyncHandler(async (req, res) => {
  const { search, status, page, limit } = req.query;
  const result = await inventoryService.getBatches({ search, status, page, limit });
  return res.status(200).json({
    success: true,
    statusCode: 200,
    message: 'Batches retrieved',
    data: result.items,
    summary: result.summary,
    pagination: result.pagination,
  });
});

export const updateBatchStatus = asyncHandler(async (req, res) => {
  const { status, reason } = req.body;
  const result = await inventoryService.updateBatchStatus(req.params.id, { status, reason }, req.user.id);
  return ApiResponse.success(res, result, 'Batch status updated');
});

export const listStockMovements = asyncHandler(async (req, res) => {
  const { batchId, movementType, limit } = req.query;
  const movements = await inventoryService.getStockMovements({ batchId, movementType, limit });
  return ApiResponse.success(res, movements, 'Stock movements ledger retrieved');
});

export const createBatch = asyncHandler(async (req, res) => {
  const result = await inventoryService.createBatch(req.body, req.user.id);
  return ApiResponse.created(res, result, 'New stock batch received and allocated');
});

export const adjustStock = asyncHandler(async (req, res) => {
  const { newQuantity, reason, movementType } = req.body;
  const result = await inventoryService.adjustStock(
    req.params.id,
    { newQuantity, reason, movementType },
    req.user.id
  );
  return ApiResponse.success(res, result, 'Stock adjusted successfully');
});

export const disposeExpiredBatch = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const result = await inventoryService.disposeExpiredBatch(req.params.id, { reason }, req.user.id);
  return ApiResponse.success(res, result, 'Expired stock written off and marked as disposed');
});

export const getExpiryAlerts = asyncHandler(async (req, res) => {
  const { days } = req.query;
  const result = await inventoryService.getExpiryAlerts(days);
  return ApiResponse.success(res, result, 'Expiry alerts retrieved');
});

export const getInventoryReports = asyncHandler(async (req, res) => {
  const result = await inventoryService.getInventoryReports();
  return ApiResponse.success(res, result, 'Inventory valuation and stock health reports retrieved');
});

export default {
  listBatches,
  createBatch,
  updateBatchStatus,
  adjustStock,
  disposeExpiredBatch,
  getExpiryAlerts,
  getInventoryReports,
  listStockMovements,
};
