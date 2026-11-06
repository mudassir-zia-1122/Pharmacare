import apiClient from './client.js';

export async function fetchPrescriptions(params = {}) {
  return apiClient.get('/prescriptions', { params });
}

export async function fetchPrescription(id) {
  return apiClient.get(`/prescriptions/${id}`);
}

export async function createPrescription(data) {
  return apiClient.post('/prescriptions', data);
}

export async function verifyPrescription(id, data = {}) {
  return apiClient.post(`/prescriptions/${id}/verify`, data);
}

export default {
  fetchPrescriptions,
  fetchPrescription,
  createPrescription,
  verifyPrescription,
};
