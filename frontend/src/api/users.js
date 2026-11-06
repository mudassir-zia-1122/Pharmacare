import apiClient from './client.js';

export async function fetchUsers() {
  return apiClient.get('/users');
}

export async function fetchUser(id) {
  return apiClient.get(`/users/${id}`);
}

export async function createUser(data) {
  return apiClient.post('/users', data);
}

export async function updateUser(id, data) {
  return apiClient.put(`/users/${id}`, data);
}

export async function toggleUserStatus(id) {
  return apiClient.patch(`/users/${id}/toggle-status`);
}

export default {
  fetchUsers,
  fetchUser,
  createUser,
  updateUser,
  toggleUserStatus,
};
