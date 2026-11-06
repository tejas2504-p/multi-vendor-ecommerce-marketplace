import { apiClient } from './api';
import {
  ApiResponse,
  ReviewItem,
  ProductReviewSummary,
  ReviewEligibility,
  CreateReviewPayload,
  UpdateReviewPayload,
  AdminReviewItem,
  ReviewModerationStatus,
} from '../types';

export interface ProductReviewsResponse {
  reviews: ReviewItem[];
  summary: ProductReviewSummary;
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  userEligibility?: ReviewEligibility | null;
}

export interface AdminReviewsResponse {
  reviews: AdminReviewItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export const reviewApi = {
  /**
   * GET /api/products/:productId/reviews
   * Retrieve approved product reviews, rating breakdown, and user vote status
   */
  getProductReviews: async (
    productId: string,
    params?: {
      rating?: number;
      sort?: string;
      page?: number;
      limit?: number;
    }
  ): Promise<ProductReviewsResponse> => {
    const response = await apiClient.get<ApiResponse<ProductReviewsResponse>>(
      `/api/products/${productId}/reviews`,
      { params }
    );
    return response.data.data;
  },

  /**
   * GET /api/products/:productId/reviews/eligibility
   * Check if current user is eligible to write a verified review
   */
  checkEligibility: async (productId: string): Promise<ReviewEligibility> => {
    const response = await apiClient.get<ApiResponse<ReviewEligibility>>(
      `/api/products/${productId}/reviews/eligibility`
    );
    return response.data.data;
  },

  /**
   * POST /api/products/:productId/reviews
   * Submit verified review for delivered product
   */
  createReview: async (
    productId: string,
    data: CreateReviewPayload
  ): Promise<ReviewItem> => {
    const response = await apiClient.post<ApiResponse<ReviewItem>>(
      `/api/products/${productId}/reviews`,
      data
    );
    return response.data.data;
  },

  /**
   * PATCH /api/reviews/:reviewId
   * Edit existing review
   */
  updateReview: async (
    reviewId: string,
    data: UpdateReviewPayload
  ): Promise<ReviewItem> => {
    const response = await apiClient.patch<ApiResponse<ReviewItem>>(
      `/api/reviews/${reviewId}`,
      data
    );
    return response.data.data;
  },

  /**
   * DELETE /api/reviews/:reviewId
   * Delete review
   */
  deleteReview: async (reviewId: string): Promise<{ message: string }> => {
    const response = await apiClient.delete<ApiResponse<{ message: string }>>(
      `/api/reviews/${reviewId}`
    );
    return response.data.data;
  },

  /**
   * POST /api/reviews/:reviewId/helpful
   * Toggle helpful vote
   */
  voteHelpful: async (
    reviewId: string
  ): Promise<{ voted: boolean; helpfulCount: number }> => {
    const response = await apiClient.post<ApiResponse<{ voted: boolean; helpfulCount: number }>>(
      `/api/reviews/${reviewId}/helpful`
    );
    return response.data.data;
  },

  /**
   * GET /api/admin/reviews
   * Admin reviews queue with moderation filters
   */
  adminListReviews: async (params?: {
    status?: ReviewModerationStatus;
    productId?: string;
    userId?: string;
    page?: number;
    limit?: number;
  }): Promise<AdminReviewsResponse> => {
    const response = await apiClient.get<ApiResponse<AdminReviewsResponse>>(
      '/api/admin/reviews',
      { params }
    );
    return response.data.data;
  },

  /**
   * PATCH /api/admin/reviews/:reviewId/status
   * Admin updates moderation status (approved, hidden, rejected, pending)
   */
  adminUpdateStatus: async (
    reviewId: string,
    status: ReviewModerationStatus,
    moderationReason?: string
  ): Promise<ReviewItem> => {
    const response = await apiClient.patch<ApiResponse<ReviewItem>>(
      `/api/admin/reviews/${reviewId}/status`,
      { status, moderationReason }
    );
    return response.data.data;
  },

  /**
   * DELETE /api/admin/reviews/:reviewId
   * Admin permanently removes review
   */
  adminDeleteReview: async (reviewId: string): Promise<{ message: string }> => {
    const response = await apiClient.delete<ApiResponse<{ message: string }>>(
      `/api/admin/reviews/${reviewId}`
    );
    return response.data.data;
  },
};

