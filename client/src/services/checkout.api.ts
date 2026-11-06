import { apiClient } from './api';
import { ApiResponse, Order } from '../types';

export const checkoutApi = {
  processCheckout: async (data: {
    addressId: string;
    idempotencyKey?: string;
    couponCode?: string;
  }): Promise<Order> => {
    const response = await apiClient.post<ApiResponse<Order>>('/api/checkout', data);
    return response.data.data;
  },

  getOrderById: async (orderId: string): Promise<Order> => {
    const response = await apiClient.get<ApiResponse<Order>>(`/api/checkout/orders/${orderId}`);
    return response.data.data;
  },

  getCustomerOrders: async (): Promise<Order[]> => {
    const response = await apiClient.get<ApiResponse<Order[]>>('/api/checkout/orders');
    return response.data.data;
  },
};

