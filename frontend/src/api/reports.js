import apiClient from './client.js';

export async function fetchSalesReport(params = {}) {
  return apiClient.get('/reports/sales', { params });
}

export async function fetchStockValuation() {
  return apiClient.get('/reports/valuation');
}

export async function fetchLowStock() {
  return apiClient.get('/reports/low-stock');
}

export async function fetchNearExpiry() {
  return apiClient.get('/reports/near-expiry');
}

export async function fetchDepartmentPrescriptions() {
  return apiClient.get('/reports/departments');
}

export async function fetchProfitLoss(params = {}) {
  return apiClient.get('/reports/profit-loss', { params });
}

export default {
  fetchSalesReport,
  fetchStockValuation,
  fetchLowStock,
  fetchNearExpiry,
  fetchDepartmentPrescriptions,
  fetchProfitLoss,
};
