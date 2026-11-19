import axios from 'axios';
import { ApiResponse, HealthData } from '../types';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT Bearer token from localStorage as fallback when cookies are restricted
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const healthApi = {
  checkHealth: async (): Promise<HealthData> => {
    const response = await apiClient.get<ApiResponse<HealthData>>('/api/health');
    return response.data.data;
  },
};
