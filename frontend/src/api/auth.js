import apiClient from './client.js';

export async function login(identifier, password) {
  return apiClient.post('/auth/login', { username: identifier, email: identifier, password });
}

export async function firebaseLogin(idToken, email) {
  return apiClient.post('/auth/firebase-login', { idToken, email });
}

export async function getMe() {
  return apiClient.get('/auth/me');
}

export async function logout() {
  return apiClient.post('/auth/logout');
}

export async function changePassword(oldPassword, newPassword) {
  return apiClient.post('/auth/change-password', { oldPassword, newPassword });
}

export default {
  login,
  firebaseLogin,
  getMe,
  logout,
  changePassword,
};
