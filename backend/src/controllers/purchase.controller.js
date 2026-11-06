import purchaseService from '../services/purchase.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const listPurchaseOrders = asyncHandler(async (req, res) => {
  const { search, status, page, limit } = req.query;
  const result = await purchaseService.getPurchaseOrders({ search, status, page, limit });
  return ApiResponse.paginate(res, result.items, result.pagination, 'Purchase orders retrieved');
});

export const getPurchaseOrder = asyncHandler(async (req, res) => {
  const po = await purchaseService.getPurchaseOrderById(req.params.id);
  return ApiResponse.success(res, po, 'Purchase order details retrieved');
});

export const createPurchaseOrder = asyncHandler(async (req, res) => {
  const created = await purchaseService.createPurchaseOrder(req.body, req.user.id);
  return ApiResponse.created(res, created, 'Purchase order created successfully');
});

export const receiveStock = asyncHandler(async (req, res) => {
  const { receivedItems } = req.body;
  const result = await purchaseService.receivePurchaseStock(req.params.id, receivedItems, req.user.id);
  return ApiResponse.success(res, result, 'Stock received successfully');
});

export default {
  listPurchaseOrders,
  getPurchaseOrder,
  createPurchaseOrder,
  receiveStock,
};
