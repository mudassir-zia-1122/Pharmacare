import apiClient from './client.js';

export async function fetchAvailableSlots(doctorId, date) {
  return apiClient.get('/appointments/available-slots', {
    params: { doctorId, date },
  });
}

export async function bookAppointment(data) {
  return apiClient.post('/appointments/book', data);
}

export async function lookupAppointment(reference, phone) {
  return apiClient.post('/appointments/lookup', { reference, phone });
}

export async function fetchWaitingRoomDisplay(date = null) {
  return apiClient.get('/appointments/queue/display', {
    params: date ? { date } : {},
  });
}

export async function fetchAppointments(params = {}) {
  return apiClient.get('/appointments', { params });
}

export async function fetchAppointmentStatsSummary(date = null) {
  return apiClient.get('/appointments/stats/summary', {
    params: date ? { date } : {},
  });
}

export async function fetchTodayQueue(doctorId = null, date = null) {
  const params = {};
  if (doctorId) params.doctorId = doctorId;
  if (date) params.date = date;
  return apiClient.get('/appointments/queue/today', { params });
}

export async function callNextPatient(doctorId, date = null) {
  return apiClient.post('/appointments/queue/call-next', { doctorId, date });
}

export async function registerWalkInToken(data) {
  return apiClient.post('/appointments/walk-in', data);
}

export async function getAppointment(id) {
  return apiClient.get(`/appointments/${id}`);
}

export async function updateAppointmentStatus(id, status, reason = null) {
  return apiClient.patch(`/appointments/${id}/status`, { status, reason });
}

export async function assignEmergencyPriority(id, priorityLevel, reason) {
  return apiClient.patch(`/appointments/${id}/priority`, { priorityLevel, reason });
}

export async function rescheduleAppointment(id, newDate, newTime, reason = null) {
  return apiClient.post(`/appointments/${id}/reschedule`, { newDate, newTime, reason });
}

export default {
  fetchAvailableSlots,
  bookAppointment,
  lookupAppointment,
  fetchWaitingRoomDisplay,
  fetchAppointments,
  fetchAppointmentStatsSummary,
  fetchTodayQueue,
  callNextPatient,
  registerWalkInToken,
  getAppointment,
  updateAppointmentStatus,
  assignEmergencyPriority,
  rescheduleAppointment,
};
