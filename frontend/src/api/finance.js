import apiClient from './client.js';

export async function fetchExpenses(params = {}) {
  return apiClient.get('/finance/expenses', { params });
}

export async function getExpense(id) {
  return apiClient.get(`/finance/expenses/${id}`);
}

export async function createExpense(data) {
  return apiClient.post('/finance/expenses', data);
}

export async function updateExpense(id, data) {
  return apiClient.put(`/finance/expenses/${id}`, data);
}

export async function deleteExpense(id) {
  return apiClient.delete(`/finance/expenses/${id}`);
}

export async function getFinancialSummary(params = {}) {
  return apiClient.get('/finance/summary', { params });
}

export async function getCashRegister(params = {}) {
  return apiClient.get('/finance/cash-register', { params });
}

export default {
  fetchExpenses,
  getExpense,
  createExpense,
  updateExpense,
  deleteExpense,
  getFinancialSummary,
  getCashRegister,
};
