import apiClient from './client.js';

export async function fetchPatients(params = {}) {
  return apiClient.get('/patients', { params });
}

export async function getPatient(id) {
  return apiClient.get(`/patients/${id}`);
}

export async function createPatient(data) {
  return apiClient.post('/patients', data);
}

export async function updatePatient(id, data) {
  return apiClient.put(`/patients/${id}`, data);
}

export async function deletePatient(id) {
  return apiClient.delete(`/patients/${id}`);
}

export async function getPatientPrescriptions(id) {
  return apiClient.get(`/patients/${id}/prescriptions`);
}

export default {
  fetchPatients,
  getPatient,
  createPatient,
  updatePatient,
  deletePatient,
  getPatientPrescriptions,
};
