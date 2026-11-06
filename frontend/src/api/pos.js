import apiClient from './client.js';

export async function searchPOSMedicines(q) {
  return apiClient.get('/pos/search', { params: { q } });
}

export async function processCheckout(checkoutData) {
  return apiClient.post('/pos/checkout', checkoutData);
}

export async function fetchSales(params = {}) {
  return apiClient.get('/pos/sales', { params });
}

export async function fetchSaleInvoice(id) {
  return apiClient.get(`/pos/sales/${id}`);
}

export default {
  searchPOSMedicines,
  processCheckout,
  fetchSales,
  fetchSaleInvoice,
};
