import userService from '../services/user.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const listUsers = asyncHandler(async (req, res) => {
  const users = await userService.listUsers();
  return ApiResponse.success(res, users, 'Users retrieved successfully');
});

export const getUser = asyncHandler(async (req, res) => {
  const user = await userService.getUserById(req.params.id);
  return ApiResponse.success(res, user, 'User retrieved successfully');
});

export const createUser = asyncHandler(async (req, res) => {
  const newUser = await userService.createUser(req.body, req.user.id);
  return ApiResponse.created(res, newUser, 'Staff user account created successfully');
});

export const updateUser = asyncHandler(async (req, res) => {
  const updatedUser = await userService.updateUser(req.params.id, req.body, req.user.id);
  return ApiResponse.success(res, updatedUser, 'User account updated successfully');
});

export const toggleStatus = asyncHandler(async (req, res) => {
  const result = await userService.toggleUserStatus(req.params.id, req.user.id);
  return ApiResponse.success(res, result, `User account ${result.status === 'active' ? 'activated' : 'disabled'}`);
});

export default {
  listUsers,
  getUser,
  createUser,
  updateUser,
  toggleStatus,
};
