import apiClient from './client.js';

export async function fetchCustomers(params = {}) {
  return apiClient.get('/customers', { params });
}

export async function getCustomer(id) {
  return apiClient.get(`/customers/${id}`);
}

export async function createCustomer(data) {
  return apiClient.post('/customers', data);
}

export async function updateCustomer(id, data) {
  return apiClient.put(`/customers/${id}`, data);
}

export async function deleteCustomer(id) {
  return apiClient.delete(`/customers/${id}`);
}

export default {
  fetchCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
};
