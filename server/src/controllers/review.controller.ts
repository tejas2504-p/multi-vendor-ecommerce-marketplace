import { Request, Response, NextFunction } from 'express';
import { ReviewService } from '../services/review.service';
import { ApiResponse } from '../utils/apiResponse';

export class ReviewController {
  /**
   * POST /api/products/:productId/reviews
   * Customer creates verified review for delivered product
   */
  static async createReview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const customerId = req.user!.id;
      const { productId } = req.params;
      const review = await ReviewService.createReview(customerId, productId, req.body);
      ApiResponse.success(res, review, 'Review submitted successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/products/:productId/reviews
   * Public retrieval of product reviews with rating breakdown and pagination
   */
  static async getProductReviews(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { productId } = req.params;
      const currentUserId = req.user?.id;
      const data = await ReviewService.getProductReviews(productId, req.query as any, currentUserId);
      ApiResponse.success(res, data, 'Product reviews retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/products/:productId/reviews/eligibility
   * Checks whether the authenticated user can review this product
   */
  static async checkEligibility(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const customerId = req.user!.id;
      const { productId } = req.params;
      const result = await ReviewService.checkEligibility(customerId, productId);
      ApiResponse.success(res, result, 'Review eligibility evaluated successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/reviews/:reviewId
   * Customer edits their own review
   */
  static async updateReview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const customerId = req.user!.id;
      const { reviewId } = req.params;
      const review = await ReviewService.updateReview(reviewId, customerId, req.body);
      ApiResponse.success(res, review, 'Review updated successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/reviews/:reviewId
   * Customer deletes their own review, or admin deletes review
   */
  static async deleteReview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const isAdmin = req.user!.role === 'admin';
      const { reviewId } = req.params;
      const result = await ReviewService.deleteReview(reviewId, userId, isAdmin);
      ApiResponse.success(res, result, 'Review deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/reviews/:reviewId/helpful
   * Toggle helpful vote on a review
   */
  static async voteHelpful(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const customerId = req.user!.id;
      const { reviewId } = req.params;
      const result = await ReviewService.voteHelpful(reviewId, customerId);
      ApiResponse.success(
        res,
        result,
        result.voted ? 'Marked review as helpful' : 'Removed helpful vote'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admin/reviews
   * Admin lists all reviews with moderation filters
   */
  static async adminListReviews(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await ReviewService.adminListReviews(req.query as any);
      ApiResponse.success(res, data, 'Admin reviews list retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/admin/reviews/:reviewId/status
   * Admin updates moderation status (approved, hidden, rejected)
   */
  static async adminUpdateModerationStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.user!.id;
      const { reviewId } = req.params;
      const { status, moderationReason } = req.body;
      const review = await ReviewService.adminUpdateModerationStatus(
        reviewId,
        adminId,
        status,
        moderationReason
      );
      ApiResponse.success(res, review, `Review status updated to '${status}'`);
    } catch (error) {
      next(error);
    }
  }
}

