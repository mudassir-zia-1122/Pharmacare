import apiClient, { API_BASE_URL } from './client.js';

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
 * Helper to build authenticated inquiry prescription image URL
 * Uses VITE_API_BASE_URL (via API_BASE_URL) and pharma_token consistently.
 */
export function getInquiryImageUrl(id, apiBaseUrl = API_BASE_URL) {
  const normalizedBase = (apiBaseUrl || '/api/v1').replace(/\/+$/, '');
  const token =
    typeof localStorage !== 'undefined' ? localStorage.getItem('pharma_token') : null;
  const baseUrl = `${normalizedBase}/inquiries/${encodeURIComponent(id)}/image`;
  return token ? `${baseUrl}?token=${encodeURIComponent(token)}` : baseUrl;
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
