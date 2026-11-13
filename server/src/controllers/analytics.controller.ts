import { Request, Response, NextFunction } from 'express';
import { AnalyticsService } from '../services/analytics.service';
import { ApiResponse } from '../utils/apiResponse';
import { analyticsQuerySchema } from '../validators/analytics.validator';

export class AnalyticsController {
  /**
   * GET /api/admin/analytics/overview
   */
  static async getOverview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = analyticsQuerySchema.parse(req.query);
      const data = await AnalyticsService.getOverview(parsed.refresh);
      ApiResponse.success(res, data, 'Overview analytics retrieved successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admin/analytics/revenue
   */
  static async getRevenue(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = analyticsQuerySchema.parse(req.query);
      const data = await AnalyticsService.getRevenueAnalytics(parsed);
      ApiResponse.success(res, data, 'Revenue analytics retrieved successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admin/analytics/orders
   */
  static async getOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = analyticsQuerySchema.parse(req.query);
      const data = await AnalyticsService.getOrderAnalytics(parsed);
      ApiResponse.success(res, data, 'Order analytics retrieved successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admin/analytics/vendors
   */
  static async getVendors(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = analyticsQuerySchema.parse(req.query);
      const data = await AnalyticsService.getVendorAnalytics(parsed);
      ApiResponse.success(res, data, 'Vendor analytics retrieved successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admin/analytics/products
   */
  static async getProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = analyticsQuerySchema.parse(req.query);
      const data = await AnalyticsService.getProductAnalytics(parsed);
      ApiResponse.success(res, data, 'Product analytics retrieved successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admin/analytics/commissions
   */
  static async getCommissions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = analyticsQuerySchema.parse(req.query);
      const data = await AnalyticsService.getCommissionAnalytics(parsed);
      ApiResponse.success(res, data, 'Commission analytics retrieved successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admin/analytics/payouts
   */
  static async getPayouts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = analyticsQuerySchema.parse(req.query);
      const data = await AnalyticsService.getPayoutAnalytics(parsed);
      ApiResponse.success(res, data, 'Payout analytics retrieved successfully', 200);
    } catch (error) {
      next(error);
    }
  }
}

