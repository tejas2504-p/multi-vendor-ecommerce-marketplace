import { apiClient } from './api';
import {
  ApiResponse,
  Payment,
  RazorpayOrderData,
  Order,
  PaymentMethodType,
  UpiQrPaymentData,
  UpiQrStatusResponse,
} from '../types';

export const paymentApi = {
  /**
   * Initiate Razorpay payment order on the backend
   */
  async createOrder(orderId: string, paymentMethod?: PaymentMethodType): Promise<RazorpayOrderData> {
    const response = await apiClient.post<ApiResponse<RazorpayOrderData>>('/api/payments/create-order', {
      orderId,
      paymentMethod,
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
    paymentMethod?: PaymentMethodType;
  }): Promise<{ payment: Payment; order: Order; isDuplicate: boolean }> {
    const response = await apiClient.post<ApiResponse<{ payment: Payment; order: Order; isDuplicate: boolean }>>(
      '/api/payments/verify',
      payload
    );
    return response.data.data;
  },

  /**
   * Retrieve payment record for a specific order
   */
  async getPaymentByOrder(orderId: string): Promise<Payment | null> {
    const response = await apiClient.get<ApiResponse<Payment | null>>(`/api/payments/order/${orderId}`);
    return response.data.data;
  },

  /**
   * Generate genuine dynamic UPI QR code
   */
  async createUpiQr(orderId: string): Promise<UpiQrPaymentData> {
    const response = await apiClient.post<ApiResponse<UpiQrPaymentData>>('/api/payments/create-qr-code', {
      orderId,
    });
    return response.data.data;
  },

  /**
   * Check UPI QR payment status
   */
  async getUpiQrStatus(orderId: string): Promise<UpiQrStatusResponse> {
    const response = await apiClient.get<ApiResponse<UpiQrStatusResponse>>(`/api/payments/qr-status/${orderId}`);
    return response.data.data;
  },

  /**
   * Cancel UPI QR payment session
   */
  async cancelUpiQr(orderId: string): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.post<ApiResponse<{ success: boolean; message: string }>>(
      '/api/payments/cancel-qr',
      { orderId }
    );
    return response.data.data;
  },

  /**
   * Simulate UPI QR payment (Sandbox / Test Mode)
   */
  async simulateUpiQr(
    orderId: string,
    outcome: 'success' | 'failed' | 'expired'
  ): Promise<{ status: string; order?: Order; payment?: Payment; message?: string }> {
    const response = await apiClient.post<
      ApiResponse<{ status: string; order?: Order; payment?: Payment; message?: string }>
    >('/api/payments/simulate-qr', {
      orderId,
      outcome,
    });
    return response.data.data;
  },
};
