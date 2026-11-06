import { Request, Response, NextFunction } from 'express';
import { CouponService } from '../services/coupon.service';
import { ApiResponse } from '../utils/apiResponse';

export class CouponController {
  /**
   * POST /api/admin/coupons
   * Create a new marketplace coupon (Admin only)
   */
  static async createCoupon(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminUserId = req.user!.id;
      const coupon = await CouponService.createCoupon(adminUserId, req.body);
      ApiResponse.created(res, coupon, `Coupon "${coupon.code}" created successfully`);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admin/coupons
   * List marketplace coupons with filters & pagination (Admin only)
   */
  static async getCoupons(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await CouponService.getCoupons(req.query as any);
      ApiResponse.success(res, result, 'Coupons retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admin/coupons/:id
   * Get coupon details by ID (Admin only)
   */
  static async getCouponById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const coupon = await CouponService.getCouponById(req.params.id);
      ApiResponse.success(res, coupon, 'Coupon retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/admin/coupons/:id
   * Update coupon fields (Admin only)
   */
  static async updateCoupon(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const updated = await CouponService.updateCoupon(req.params.id, req.body);
      ApiResponse.success(res, updated, `Coupon "${updated.code}" updated successfully`);
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/admin/coupons/:id
   * Delete or deactivate coupon (Admin only)
   */
  static async deleteCoupon(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await CouponService.deleteCoupon(req.params.id);
      ApiResponse.success(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/coupons/validate
   * Validate coupon code against customer cart
   */
  static async validateCoupon(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const customerId = req.user!.id;
      const result = await CouponService.validateCouponForCart(
        customerId,
        req.body.couponCode,
        req.body.cartId
      );
      ApiResponse.success(res, result, `Coupon "${result.coupon.code}" is valid and applied`);
    } catch (error) {
      next(error);
    }
  }
}
