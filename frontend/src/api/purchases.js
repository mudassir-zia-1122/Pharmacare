import apiClient from './client.js';

export async function fetchPurchaseOrders(params = {}) {
  return apiClient.get('/purchases', { params });
}

export async function fetchPurchaseOrder(id) {
  return apiClient.get(`/purchases/${id}`);
}

export async function createPurchaseOrder(data) {
  return apiClient.post('/purchases', data);
}

export async function receivePurchaseStock(id, receivedItems) {
  return apiClient.post(`/purchases/${id}/receive`, { receivedItems });
}

export default {
  fetchPurchaseOrders,
  fetchPurchaseOrder,
  createPurchaseOrder,
  receivePurchaseStock,
};
