import { apiClient } from './api';
import {
  ApiResponse,
  Coupon,
  CouponValidationResponse,
  CreateCouponPayload,
  UpdateCouponPayload,
} from '../types';

export const couponApi = {
  /**
   * Validate a coupon against current customer cart
   */
  validateCoupon: async (couponCode: string, cartId?: string): Promise<CouponValidationResponse> => {
    const response = await apiClient.post<ApiResponse<CouponValidationResponse>>('/api/coupons/validate', {
      couponCode,
      cartId,
    });
    return response.data.data;
  },

  /**
   * Admin: List coupons with filters and pagination
   */
  adminGetCoupons: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    discountType?: string;
  }): Promise<{
    coupons: Coupon[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> => {
    const response = await apiClient.get<
      ApiResponse<{
        coupons: Coupon[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      }>
    >('/api/admin/coupons', { params });
    return response.data.data;
  },

  /**
   * Admin: Get coupon by ID
   */
  adminGetCouponById: async (id: string): Promise<Coupon> => {
    const response = await apiClient.get<ApiResponse<Coupon>>(`/api/admin/coupons/${id}`);
    return response.data.data;
  },

  /**
   * Admin: Create new coupon
   */
  adminCreateCoupon: async (data: CreateCouponPayload): Promise<Coupon> => {
    const response = await apiClient.post<ApiResponse<Coupon>>('/api/admin/coupons', data);
    return response.data.data;
  },

  /**
   * Admin: Update coupon
   */
  adminUpdateCoupon: async (id: string, data: UpdateCouponPayload): Promise<Coupon> => {
    const response = await apiClient.patch<ApiResponse<Coupon>>(`/api/admin/coupons/${id}`, data);
    return response.data.data;
  },

  /**
   * Admin: Delete coupon
   */
  adminDeleteCoupon: async (id: string): Promise<{ deactivated: boolean; message: string }> => {
    const response = await apiClient.delete<ApiResponse<{ deactivated: boolean; message: string }>>(
      `/api/admin/coupons/${id}`
    );
    return response.data.data;
  },
};

