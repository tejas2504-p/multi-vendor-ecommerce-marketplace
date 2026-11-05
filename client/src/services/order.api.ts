import { apiClient } from './api';
import { ApiResponse, Order, VendorOrder } from '../types';

export const orderApi = {
  // Customer endpoints
  getCustomerOrders: async (): Promise<Order[]> => {
    const response = await apiClient.get<ApiResponse<Order[]>>('/api/orders');
    return response.data.data;
  },

  getCustomerOrderById: async (orderId: string): Promise<Order> => {
    const response = await apiClient.get<ApiResponse<Order>>(`/api/orders/${orderId}`);
    return response.data.data;
  },

  getCustomerVendorOrders: async (orderId: string): Promise<VendorOrder[]> => {
    const response = await apiClient.get<ApiResponse<VendorOrder[]>>(`/api/orders/${orderId}/vendor-orders`);
    return response.data.data;
  },

  // Vendor endpoints
  getVendorOrders: async (status?: string): Promise<VendorOrder[]> => {
    const params = status ? { status } : {};
    const response = await apiClient.get<ApiResponse<VendorOrder[]>>('/api/vendor/orders', { params });
    return response.data.data;
  },

  getVendorOrderById: async (vendorOrderId: string): Promise<VendorOrder> => {
    const response = await apiClient.get<ApiResponse<VendorOrder>>(`/api/vendor/orders/${vendorOrderId}`);
    return response.data.data;
  },

  updateVendorOrderStatus: async (
    vendorOrderId: string,
    data: {
      status: string;
      carrier?: string;
      trackingNumber?: string;
      note?: string;
      cancellationReason?: string;
    }
  ): Promise<VendorOrder> => {
    const response = await apiClient.patch<ApiResponse<VendorOrder>>(
      `/api/vendor/orders/${vendorOrderId}/status`,
      data
    );
    return response.data.data;
  },

  // Admin endpoints
  getAdminOrders: async (params?: {
    status?: string;
    paymentStatus?: string;
    customerId?: string;
    page?: number;
    limit?: number;
  }): Promise<{ orders: Order[]; meta?: any }> => {
    const response = await apiClient.get<ApiResponse<Order[]>>('/api/admin/orders', { params });
    return {
      orders: response.data.data,
      meta: response.data.meta,
    };
  },

  getAdminOrderById: async (orderId: string): Promise<Order> => {
    const response = await apiClient.get<ApiResponse<Order>>(`/api/admin/orders/${orderId}`);
    return response.data.data;
  },

  getAdminVendorOrders: async (params?: {
    vendorId?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{ vendorOrders: VendorOrder[]; meta?: any }> => {
    const response = await apiClient.get<ApiResponse<VendorOrder[]>>('/api/admin/vendor-orders', { params });
    return {
      vendorOrders: response.data.data,
      meta: response.data.meta,
    };
  },

  adminUpdateOrderStatus: async (orderId: string, status: string, note?: string): Promise<Order> => {
    const response = await apiClient.patch<ApiResponse<Order>>(`/api/admin/orders/${orderId}/status`, {
      status,
      note,
    });
    return response.data.data;
  },
};

