import apiClient from './client.js';

export async function fetchDoctors(params = {}) {
  return apiClient.get('/doctors', { params });
}

export async function getDoctor(id) {
  return apiClient.get(`/doctors/${id}`);
}

export async function createDoctor(data) {
  return apiClient.post('/doctors', data);
}

export async function updateDoctor(id, data) {
  return apiClient.put(`/doctors/${id}`, data);
}

export async function deleteDoctor(id) {
  return apiClient.delete(`/doctors/${id}`);
}

export async function fetchDepartments() {
  return apiClient.get('/doctors/departments');
}

export async function uploadDoctorPhoto(id, formData) {
  return apiClient.post(`/doctors/${id}/photo`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

export async function removeDoctorPhoto(id) {
  return apiClient.delete(`/doctors/${id}/photo`);
}

export async function getDoctorSchedule(id) {
  return apiClient.get(`/doctors/${id}/schedule`);
}

export async function saveDoctorSchedule(id, data) {
  return apiClient.post(`/doctors/${id}/schedule`, data);
}

export async function fetchDoctorLeaves(params = {}) {
  return apiClient.get('/doctors/leaves', { params });
}

export async function createDoctorLeave(data) {
  return apiClient.post('/doctors/leaves', data);
}

export async function updateDoctorLeaveStatus(id, status) {
  return apiClient.patch(`/doctors/leaves/${id}/status`, { status });
}

export default {
  fetchDoctors,
  getDoctor,
  createDoctor,
  updateDoctor,
  deleteDoctor,
  fetchDepartments,
  uploadDoctorPhoto,
  removeDoctorPhoto,
  getDoctorSchedule,
  saveDoctorSchedule,
  fetchDoctorLeaves,
  createDoctorLeave,
  updateDoctorLeaveStatus,
};
