import { apiClient } from './api';
import {
  ApiResponse,
  AuthUser,
  LoginCredentials,
  RegisterCredentials,
} from '../types';

export const authApi = {
  /**
   * Register a new user account (defaults to Customer role).
   */
  register: async (credentials: RegisterCredentials): Promise<AuthUser> => {
    const res = await apiClient.post<ApiResponse<AuthUser>>('/api/auth/register', credentials);
    return res.data.data;
  },

  /**
   * Login with email and password.
   */
  login: async (credentials: LoginCredentials): Promise<AuthUser> => {
    const res = await apiClient.post<ApiResponse<AuthUser>>('/api/auth/login', credentials);
    return res.data.data;
  },

  /**
   * Get the current authenticated user's session profile.
   */
  getMe: async (): Promise<AuthUser> => {
    const res = await apiClient.get<ApiResponse<AuthUser>>('/api/auth/me');
    return res.data.data;
  },

  /**
   * Logout and clear authentication cookies.
   */
  logout: async (): Promise<void> => {
    await apiClient.post('/api/auth/logout');
  },

  /**
   * Role-based access test probes.
   */
  testRoleAccess: async (role: 'customer' | 'vendor' | 'admin'): Promise<any> => {
    const res = await apiClient.get(`/api/${role}/dashboard`);
    return res.data;
  },

  /**
   * Apply as vendor.
   */
  applyVendor: async (data: any): Promise<any> => {
    const res = await apiClient.post('/api/vendors/apply', data);
    return res.data;
  },

  /**
   * Get vendor application status.
   */
  getVendorStatus: async (): Promise<any> => {
    const res = await apiClient.get('/api/vendors/status');
    return res.data;
  },
};

