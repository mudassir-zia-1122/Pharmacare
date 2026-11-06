import apiClient from './client.js';

export async function fetchNotifications(params = {}) {
  return apiClient.get('/notifications', { params });
}

export async function getUnreadCount() {
  return apiClient.get('/notifications/unread-count');
}

export async function markAsRead(id) {
  return apiClient.patch(`/notifications/${id}/read`);
}

export async function markAllAsRead() {
  return apiClient.patch('/notifications/mark-all-read');
}

export default {
  fetchNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
};
