import apiClient from './client.js';

export async function fetchMedicines(params = {}) {
  return apiClient.get('/medicines', { params });
}

export async function fetchMedicine(id) {
  return apiClient.get(`/medicines/${id}`);
}

export async function createMedicine(data) {
  return apiClient.post('/medicines', data);
}

export async function updateMedicine(id, data) {
  return apiClient.put(`/medicines/${id}`, data);
}

export async function updateMedicineStatus(id, status) {
  return apiClient.patch(`/medicines/${id}/status`, { status });
}

export async function importMedicines(rows) {
  return apiClient.post('/medicines/import', { rows });
}

export async function fetchCategories() {
  return apiClient.get('/medicines/categories');
}

export async function createCategory(data) {
  return apiClient.post('/medicines/categories', data);
}

export async function fetchDosageForms() {
  return apiClient.get('/medicines/dosage-forms');
}

export async function fetchManufacturers() {
  return apiClient.get('/medicines/manufacturers');
}

export default {
  fetchMedicines,
  fetchMedicine,
  createMedicine,
  updateMedicine,
  updateMedicineStatus,
  importMedicines,
  fetchCategories,
  createCategory,
  fetchDosageForms,
  fetchManufacturers,
};
