import { apiClient } from './api';
import { ApiResponse, Cart } from '../types';

export const cartApi = {
  getCart: async (): Promise<Cart> => {
    const response = await apiClient.get<ApiResponse<Cart>>('/api/cart');
    return response.data.data;
  },

  addToCart: async (productId: string, quantity: number = 1): Promise<Cart> => {
    const response = await apiClient.post<ApiResponse<Cart>>('/api/cart/add', {
      productId,
      quantity,
    });
    return response.data.data;
  },

  updateQuantity: async (productId: string, quantity: number): Promise<Cart> => {
    const response = await apiClient.patch<ApiResponse<Cart>>(`/api/cart/update/${productId}`, {
      quantity,
    });
    return response.data.data;
  },

  removeItem: async (productId: string): Promise<Cart> => {
    const response = await apiClient.delete<ApiResponse<Cart>>(`/api/cart/remove/${productId}`);
    return response.data.data;
  },

  clearCart: async (): Promise<Cart> => {
    const response = await apiClient.delete<ApiResponse<Cart>>('/api/cart/clear');
    return response.data.data;
  },
};

