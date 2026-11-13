import { apiClient } from './api';
import {
  ApiResponse,
  AnalyticsOverview,
  RevenueAnalytics,
  OrderAnalytics,
  VendorAnalytics,
  ProductAnalytics,
  CommissionAnalytics,
  PayoutAnalytics,
} from '../types';

export interface AnalyticsFilterParams {
  startDate?: string;
  endDate?: string;
  period?: '7d' | '30d' | '90d' | '12m';
  groupBy?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  refresh?: boolean;
  page?: number;
  limit?: number;
  vendorId?: string;
}

export const analyticsApi = {
  /**
   * Retrieves high-level executive KPI overview.
   */
  getOverview: async (refresh?: boolean): Promise<AnalyticsOverview> => {
    const response = await apiClient.get<ApiResponse<AnalyticsOverview>>('/api/admin/analytics/overview', {
      params: refresh ? { refresh: true } : undefined,
    });
    return response.data.data;
  },

  /**
   * Retrieves time-series revenue, transaction volume, and AOV.
   */
  getRevenue: async (params?: AnalyticsFilterParams): Promise<RevenueAnalytics> => {
    const response = await apiClient.get<ApiResponse<RevenueAnalytics>>('/api/admin/analytics/revenue', {
      params,
    });
    return response.data.data;
  },

  /**
   * Retrieves order fulfillment breakdown and status distribution.
   */
  getOrders: async (params?: AnalyticsFilterParams): Promise<OrderAnalytics> => {
    const response = await apiClient.get<ApiResponse<OrderAnalytics>>('/api/admin/analytics/orders', {
      params,
    });
    return response.data.data;
  },

  /**
   * Retrieves vendor-wise performance, sales, and net earnings.
   */
  getVendors: async (params?: AnalyticsFilterParams): Promise<VendorAnalytics> => {
    const response = await apiClient.get<ApiResponse<VendorAnalytics>>('/api/admin/analytics/vendors', {
      params,
    });
    return response.data.data;
  },

  /**
   * Retrieves best-selling products, inventory health, and category revenue.
   */
  getProducts: async (params?: AnalyticsFilterParams): Promise<ProductAnalytics> => {
    const response = await apiClient.get<ApiResponse<ProductAnalytics>>('/api/admin/analytics/products', {
      params,
    });
    return response.data.data;
  },

  /**
   * Retrieves platform commission earnings and top merchant contributions.
   */
  getCommissions: async (params?: AnalyticsFilterParams): Promise<CommissionAnalytics> => {
    const response = await apiClient.get<ApiResponse<CommissionAnalytics>>('/api/admin/analytics/commissions', {
      params,
    });
    return response.data.data;
  },

  /**
   * Retrieves treasury payout totals, pending requests, and disbursement history.
   */
  getPayouts: async (params?: AnalyticsFilterParams): Promise<PayoutAnalytics> => {
    const response = await apiClient.get<ApiResponse<PayoutAnalytics>>('/api/admin/analytics/payouts', {
      params,
    });
    return response.data.data;
  },
};

