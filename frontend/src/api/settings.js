import apiClient from './client.js';

export async function fetchSettings() {
  return apiClient.get('/settings');
}

export async function updateSettings(settingsMap) {
  return apiClient.post('/settings', settingsMap);
}

export async function fetchCurrencies() {
  return apiClient.get('/settings/currencies');
}

export async function fetchTaxRules() {
  return apiClient.get('/settings/tax-rules');
}

export async function fetchSuppliers() {
  return apiClient.get('/suppliers');
}

export async function createSupplier(data) {
  return apiClient.post('/suppliers', data);
}

export async function updateSupplier(id, data) {
  return apiClient.put(`/suppliers/${id}`, data);
}

export async function deleteSupplier(id) {
  return apiClient.delete(`/suppliers/${id}`);
}

export async function fetchCustomers(params = {}) {
  return apiClient.get('/settings/customers', { params });
}

export default {
  fetchSettings,
  updateSettings,
  fetchCurrencies,
  fetchTaxRules,
  fetchSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  fetchCustomers,
};
