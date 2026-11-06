import authService from '../services/auth.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const login = asyncHandler(async (req, res) => {
  const identifier = req.body.username || req.body.email || req.body.identifier;
  const { password } = req.body;
  const ipAddress = req.ip || req.connection.remoteAddress;
  const userAgent = req.headers['user-agent'];

  const result = await authService.loginUser(identifier, password, ipAddress, userAgent);
  return ApiResponse.success(res, result, 'Login successful');
});

export const firebaseLogin = asyncHandler(async (req, res) => {
  const { idToken, email } = req.body;
  const ipAddress = req.ip || req.connection.remoteAddress;
  const userAgent = req.headers['user-agent'];

  const result = await authService.loginWithFirebase(idToken, email, ipAddress, userAgent);
  return ApiResponse.success(res, result, 'Firebase authentication successful');
});

export const getMe = asyncHandler(async (req, res) => {
  const profile = await authService.getUserProfile(req.user.id);
  return ApiResponse.success(res, profile, 'Profile retrieved successfully');
});

export const changePassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const ipAddress = req.ip || req.connection.remoteAddress;

  const result = await authService.changeUserPassword(req.user.id, oldPassword, newPassword, ipAddress);
  return ApiResponse.success(res, result, 'Password updated successfully');
});

export const logout = asyncHandler(async (req, res) => {
  return ApiResponse.success(res, null, 'Logged out successfully');
});

export default {
  login,
  firebaseLogin,
  getMe,
  changePassword,
  logout,
};
