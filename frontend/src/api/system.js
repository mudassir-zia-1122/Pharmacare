import apiClient from './client.js';

export async function checkSystemHealth() {
  try {
    return await apiClient.get('/health');
  } catch (err) {
    return {
      status: 'offline',
      database: { connected: false, error: err.message },
    };
  }
}

export default {
  checkSystemHealth,
};
