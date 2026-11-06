import { apiClient } from './api';
import {
  ApiResponse,
  VendorEarningsSummary,
  VendorLedgerEntry,
  VendorPayoutRecord,
  AdminCommissionOverview,
} from '../types';

export const payoutApi = {
  // ==========================================
  // Vendor Endpoints
  // ==========================================

  getVendorEarnings: async (): Promise<VendorEarningsSummary> => {
    const response = await apiClient.get<ApiResponse<VendorEarningsSummary>>('/api/vendor/earnings');
    return response.data.data;
  },

  getVendorTransactions: async (page = 1, limit = 20): Promise<{
    transactions: VendorLedgerEntry[];
    pagination: { page: number; limit: number; total: number; pages: number };
  }> => {
    const response = await apiClient.get<
      ApiResponse<{
        transactions: VendorLedgerEntry[];
        pagination: { page: number; limit: number; total: number; pages: number };
      }>
    >('/api/vendor/transactions', { params: { page, limit } });
    return response.data.data;
  },

  getVendorPayouts: async (page = 1, limit = 20): Promise<{
    payouts: VendorPayoutRecord[];
    pagination: { page: number; limit: number; total: number; pages: number };
  }> => {
    const response = await apiClient.get<
      ApiResponse<{
        payouts: VendorPayoutRecord[];
        pagination: { page: number; limit: number; total: number; pages: number };
      }>
    >('/api/vendor/payouts', { params: { page, limit } });
    return response.data.data;
  },

  requestPayout: async (data: {
    amount: number;
    destinationReference: string;
    idempotencyKey?: string;
  }): Promise<VendorPayoutRecord> => {
    const response = await apiClient.post<ApiResponse<VendorPayoutRecord>>(
      '/api/vendor/payouts/request',
      data
    );
    return response.data.data;
  },

  // ==========================================
  // Admin Endpoints
  // ==========================================

  getAdminPayouts: async (params?: {
    status?: string;
    vendorId?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    payouts: VendorPayoutRecord[];
    overview: AdminCommissionOverview;
    pagination: { page: number; limit: number; total: number; pages: number };
  }> => {
    const response = await apiClient.get<
      ApiResponse<{
        payouts: VendorPayoutRecord[];
        overview: AdminCommissionOverview;
        pagination: { page: number; limit: number; total: number; pages: number };
      }>
    >('/api/admin/payouts', { params });
    return response.data.data;
  },

  getAdminPayoutById: async (payoutId: string): Promise<{
    payout: VendorPayoutRecord;
    earnings: VendorEarningsSummary;
    vendorProfile: any;
    recentLedgers: VendorLedgerEntry[];
  }> => {
    const response = await apiClient.get<
      ApiResponse<{
        payout: VendorPayoutRecord;
        earnings: VendorEarningsSummary;
        vendorProfile: any;
        recentLedgers: VendorLedgerEntry[];
      }>
    >(`/api/admin/payouts/${payoutId}`);
    return response.data.data;
  },

  approvePayout: async (payoutId: string): Promise<VendorPayoutRecord> => {
    const response = await apiClient.patch<ApiResponse<VendorPayoutRecord>>(
      `/api/admin/payouts/${payoutId}/approve`
    );
    return response.data.data;
  },

  rejectPayout: async (payoutId: string, rejectionReason: string): Promise<VendorPayoutRecord> => {
    const response = await apiClient.patch<ApiResponse<VendorPayoutRecord>>(
      `/api/admin/payouts/${payoutId}/reject`,
      { rejectionReason }
    );
    return response.data.data;
  },

  updatePayoutStatus: async (
    payoutId: string,
    data: {
      status: string;
      providerReference?: string;
      failureReason?: string;
      rejectionReason?: string;
    }
  ): Promise<VendorPayoutRecord> => {
    const response = await apiClient.patch<ApiResponse<VendorPayoutRecord>>(
      `/api/admin/payouts/${payoutId}/status`,
      data
    );
    return response.data.data;
  },

  getCommissionSettings: async (): Promise<AdminCommissionOverview> => {
    const response = await apiClient.get<ApiResponse<AdminCommissionOverview>>('/api/admin/commission');
    return response.data.data;
  },

  updatePlatformCommission: async (rate: number): Promise<any> => {
    const response = await apiClient.put<ApiResponse<any>>('/api/admin/commission/platform', { rate });
    return response.data.data;
  },

  updateVendorCommission: async (vendorId: string, rate: number | null): Promise<any> => {
    const response = await apiClient.put<ApiResponse<any>>(
      `/api/admin/commission/vendors/${vendorId}`,
      { rate }
    );
    return response.data.data;
  },
};

