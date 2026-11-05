import { apiClient } from './api';
import { ApiResponse, Payment, RazorpayOrderData, Order } from '../types';

export const paymentApi = {
  /**
   * Initiate Razorpay payment order on the backend
   */
  async createOrder(orderId: string): Promise<RazorpayOrderData> {
    const response = await apiClient.post<ApiResponse<RazorpayOrderData>>('/payments/create-order', {
      orderId,
    });
    return response.data.data;
  },

  /**
   * Cryptographically verify payment signature and capture payment
   */
  async verifyPayment(payload: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }): Promise<{ payment: Payment; order: Order; isDuplicate: boolean }> {
    const response = await apiClient.post<ApiResponse<{ payment: Payment; order: Order; isDuplicate: boolean }>>(
      '/payments/verify',
      payload
    );
    return response.data.data;
  },

  /**
   * Retrieve payment record for a specific order
   */
  async getPaymentByOrder(orderId: string): Promise<Payment | null> {
    const response = await apiClient.get<ApiResponse<Payment | null>>(`/payments/order/${orderId}`);
    return response.data.data;
  },
};
