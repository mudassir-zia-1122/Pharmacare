import apiClient from './client.js';

export async function fetchReturns(params = {}) {
  return apiClient.get('/returns', { params });
}

export async function processSaleReturn(returnData) {
  return apiClient.post('/returns/sales', returnData);
}

export default {
  fetchReturns,
  processSaleReturn,
};
