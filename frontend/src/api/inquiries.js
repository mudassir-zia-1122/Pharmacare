import apiClient from './client.js';

/**
 * Public: Doctors submit medicine availability check
 */
export async function submitInquiry(formData) {
  return apiClient.post('/inquiries', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
}

/**
 * Staff: List all doctor inquiries with filters
 */
export async function fetchInquiries(params = {}) {
  return apiClient.get('/inquiries', { params });
}

/**
 * Staff: Get inquiry details by ID
 */
export async function fetchInquiry(id) {
  return apiClient.get(`/inquiries/${id}`);
}

/**
 * Staff: Save matched medicine items
 */
export async function saveInquiryItems(id, items) {
  return apiClient.post(`/inquiries/${id}/items`, { items });
}

/**
 * Staff: Dispatch email response to doctor
 */
export async function respondToInquiry(id, responseNotes, items) {
  return apiClient.post(`/inquiries/${id}/respond`, { responseNotes, items });
}

/**
 * Staff: Retry failed email response
 */
export async function retryInquiryEmail(id) {
  return apiClient.post(`/inquiries/${id}/retry-email`);
}

/**
 * Helper to build secure image URL
 */
export function getInquiryImageUrl(id) {
  const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token') || localStorage.getItem('token');
  return token ? `/api/v1/inquiries/${id}/image?token=${encodeURIComponent(token)}` : `/api/v1/inquiries/${id}/image`;
}

export default {
  submitInquiry,
  fetchInquiries,
  fetchInquiry,
  saveInquiryItems,
  respondToInquiry,
  retryInquiryEmail,
  getInquiryImageUrl,
};
