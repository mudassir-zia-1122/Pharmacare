import apiClient from './client.js';

export async function fetchBatches(params = {}) {
  return apiClient.get('/inventory/batches', { params });
}

export async function createBatch(data) {
  return apiClient.post('/inventory/batches', data);
}

export async function updateBatchStatus(batchId, status, reason) {
  return apiClient.patch(`/inventory/batches/${batchId}/status`, { status, reason });
}

export async function adjustStock(batchId, newQuantity, reason, movementType = 'AUDIT_ADJUSTMENT') {
  return apiClient.patch(`/inventory/batches/${batchId}/adjust`, { newQuantity, reason, movementType });
}

export async function disposeExpiredBatch(batchId, reason) {
  return apiClient.post(`/inventory/batches/${batchId}/dispose`, { reason });
}

export async function fetchExpiryAlerts(days = 90) {
  return apiClient.get('/inventory/alerts', { params: { days } });
}

export async function fetchInventoryReports() {
  return apiClient.get('/inventory/reports');
}

export async function fetchStockMovements(params = {}) {
  return apiClient.get('/inventory/movements', { params });
}

export default {
  fetchBatches,
  createBatch,
  updateBatchStatus,
  adjustStock,
  disposeExpiredBatch,
  fetchExpiryAlerts,
  fetchInventoryReports,
  fetchStockMovements,
};
