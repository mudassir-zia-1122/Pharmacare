import apiClient from './client.js';

export async function getDashboardSummary() {
  return apiClient.get('/dashboard/summary');
}

export default {
  getDashboardSummary,
};
