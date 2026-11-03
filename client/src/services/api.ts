import axios from 'axios';
import { ApiResponse, HealthData } from '../types';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const healthApi = {
  checkHealth: async (): Promise<HealthData> => {
    const response = await apiClient.get<ApiResponse<HealthData>>('/api/health');
    return response.data.data;
  },
};
