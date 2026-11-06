import customerService from '../services/customer.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const listCustomers = asyncHandler(async (req, res) => {
  const { search, page, limit } = req.query;
  const result = await customerService.getCustomers({ search, page, limit });
  return ApiResponse.paginate(res, result.items, result.pagination, 'Customers retrieved successfully');
});

export const getCustomer = asyncHandler(async (req, res) => {
  const customer = await customerService.getCustomerById(req.params.id);
  return ApiResponse.success(res, customer, 'Customer details retrieved');
});

export const createCustomer = asyncHandler(async (req, res) => {
  const created = await customerService.createCustomer(req.body, req.user.id);
  return ApiResponse.created(res, created, 'Customer created successfully');
});

export const updateCustomer = asyncHandler(async (req, res) => {
  const updated = await customerService.updateCustomer(req.params.id, req.body, req.user.id);
  return ApiResponse.success(res, updated, 'Customer updated successfully');
});

export const deleteCustomer = asyncHandler(async (req, res) => {
  const result = await customerService.deleteCustomer(req.params.id, req.user.id);
  return ApiResponse.success(res, result, 'Customer removed successfully');
});

export default {
  listCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
};
