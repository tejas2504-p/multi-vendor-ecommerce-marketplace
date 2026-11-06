import { Router, Request, Response } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/rbac.middleware';
import { validateBody, validateParams, validateQuery } from '../middlewares/validate.middleware';
import { rejectVendorSchema } from '../validators/vendor.validator';
import { updateProductStatusSchema } from '../validators/product.validator';
import { orderParamSchema, adminUpdateOrderStatusSchema } from '../validators/order.validator';
import {
  updatePlatformCommissionSchema,
  updateVendorCommissionSchema,
  updatePayoutStatusSchema,
  rejectPayoutSchema,
} from '../validators/commission.validator';
import {
  adminReviewQuerySchema,
  updateReviewModerationSchema,
  reviewParamSchema,
} from '../validators/review.validator';
import {
  createCouponSchema,
  updateCouponSchema,
  couponQuerySchema,
  couponParamSchema,
} from '../validators/coupon.validator';
import { AdminVendorController } from '../controllers/adminVendor.controller';
import { ProductController } from '../controllers/product.controller';
import { OrderController } from '../controllers/order.controller';
import { CommissionController } from '../controllers/commission.controller';
import { ReviewController } from '../controllers/review.controller';
import { CouponController } from '../controllers/coupon.controller';
import { ApiResponse } from '../utils/apiResponse';

const router = Router();

/**
 * GET /api/admin/dashboard
 * Protected: Strictly requires authenticated user with 'admin' role
 */
router.get(
  '/dashboard',
  authenticate,
  authorize('admin'),
  (req: Request, res: Response) => {
    ApiResponse.success(
      res,
      {
        user: req.user,
        portal: 'Super-Admin Governance Console',
        accessibleFeatures: [
          'Vendor KYC & Onboarding Approvals',
          'Platform Commission Rate Management',
          'Master Financial Oversight & Escrow Holds',
          'Dispute Mediation & Content Moderation',
        ],
      },
      'Welcome to your Super-Admin Dashboard'
    );
  }
);

/**
 * GET /api/admin/vendors
 * List vendor applications (pending, approved, rejected)
 */
router.get(
  '/vendors',
  authenticate,
  authorize('admin'),
  AdminVendorController.listApplications
);

/**
 * GET /api/admin/vendors/:id
 * Retrieve specific vendor application details
 */
router.get(
  '/vendors/:id',
  authenticate,
  authorize('admin'),
  AdminVendorController.getApplicationById
);

/**
 * PATCH /api/admin/vendors/:id/approve
 * Approve pending vendor application and activate seller account
 */
router.patch(
  '/vendors/:id/approve',
  authenticate,
  authorize('admin'),
  AdminVendorController.approveApplication
);

/**
 * PATCH /api/admin/vendors/:id/reject
 * Reject pending vendor application with feedback reason
 */
router.patch(
  '/vendors/:id/reject',
  authenticate,
  authorize('admin'),
  validateBody(rejectVendorSchema),
  AdminVendorController.rejectApplication
);

/**
 * GET /api/admin/products
 * List all marketplace products across merchants
 */
router.get(
  '/products',
  authenticate,
  authorize('admin'),
  ProductController.adminList
);

/**
 * PATCH /api/admin/products/:id/status
 * Administrative product moderation (active, inactive, draft)
 */
router.patch(
  '/products/:id/status',
  authenticate,
  authorize('admin'),
  validateBody(updateProductStatusSchema),
  ProductController.adminUpdateStatus
);

/**
 * POST /api/admin/products/reindex
 * Administrative bulk reindexing of products from MongoDB to Elasticsearch
 */
router.post(
  '/products/reindex',
  authenticate,
  authorize('admin'),
  ProductController.adminReindex
);

/**
 * GET /api/admin/orders
 * Protected: Admin view of all platform parent orders with filtering
 */
router.get('/orders', authenticate, authorize('admin'), OrderController.getAdminOrders);

/**
 * GET /api/admin/orders/:orderId
 * Protected: Admin view of specific order details
 */
router.get(
  '/orders/:orderId',
  authenticate,
  authorize('admin'),
  validateParams(orderParamSchema),
  OrderController.getAdminOrderById
);

/**
 * GET /api/admin/vendor-orders
 * Protected: Admin overview of all vendor orders across platform
 */
router.get('/vendor-orders', authenticate, authorize('admin'), OrderController.getAdminVendorOrders);

/**
 * PATCH /api/admin/orders/:orderId/status
 * Protected: Admin status override of parent order
 */
router.patch(
  '/orders/:orderId/status',
  authenticate,
  authorize('admin'),
  validateParams(orderParamSchema),
  validateBody(adminUpdateOrderStatusSchema),
  OrderController.adminUpdateOrderStatus
);

/**
 * Phase 8B: Platform Commission & Payout Management Endpoints
 */

/**
 * GET /api/admin/payouts
 * Protected: List all vendor payout requests with status filtering
 */
router.get('/payouts', authenticate, authorize('admin'), CommissionController.getAdminPayouts);

/**
 * GET /api/admin/payouts/:payoutId
 * Protected: Payout detail with audit & vendor history
 */
router.get('/payouts/:payoutId', authenticate, authorize('admin'), CommissionController.getAdminPayoutById);

/**
 * PATCH /api/admin/payouts/:payoutId/approve
 * Protected: Approve payout request
 */
router.patch('/payouts/:payoutId/approve', authenticate, authorize('admin'), CommissionController.approvePayout);

/**
 * PATCH /api/admin/payouts/:payoutId/reject
 * Protected: Reject payout request with reason and balance restoration
 */
router.patch(
  '/payouts/:payoutId/reject',
  authenticate,
  authorize('admin'),
  validateBody(rejectPayoutSchema),
  CommissionController.rejectPayout
);

/**
 * PATCH /api/admin/payouts/:payoutId/status
 * Protected: Update processing status (processing, paid, failed)
 */
router.patch(
  '/payouts/:payoutId/status',
  authenticate,
  authorize('admin'),
  validateBody(updatePayoutStatusSchema),
  CommissionController.updatePayoutStatus
);

/**
 * GET /api/admin/commission
 * Protected: Commission overview and vendor overrides
 */
router.get('/commission', authenticate, authorize('admin'), CommissionController.getCommissionSettings);

/**
 * PUT /api/admin/commission/platform
 * Protected: Update global platform commission rate
 */
router.put(
  '/commission/platform',
  authenticate,
  authorize('admin'),
  validateBody(updatePlatformCommissionSchema),
  CommissionController.updatePlatformCommission
);

/**
 * PUT /api/admin/commission/vendors/:vendorId
 * Protected: Update custom commission rate override for a vendor
 */
router.put(
  '/commission/vendors/:vendorId',
  authenticate,
  authorize('admin'),
  validateBody(updateVendorCommissionSchema),
  CommissionController.updateVendorCommission
);

/**
 * Phase 9A: Product Review Moderation Endpoints
 */

/**
 * GET /api/admin/reviews
 * Protected: List all customer reviews with moderation status filter
 */
router.get(
  '/reviews',
  authenticate,
  authorize('admin'),
  validateQuery(adminReviewQuerySchema),
  ReviewController.adminListReviews
);

/**
 * PATCH /api/admin/reviews/:reviewId/status
 * Protected: Admin updates moderation status (approved, hidden, rejected, pending)
 */
router.patch(
  '/reviews/:reviewId/status',
  authenticate,
  authorize('admin'),
  validateParams(reviewParamSchema),
  validateBody(updateReviewModerationSchema),
  ReviewController.adminUpdateModerationStatus
);

/**
 * DELETE /api/admin/reviews/:reviewId
 * Protected: Admin permanently removes review
 */
router.delete(
  '/reviews/:reviewId',
  authenticate,
  authorize('admin'),
  validateParams(reviewParamSchema),
  ReviewController.deleteReview
);

/**
 * Phase 9B: Admin Marketplace Coupon & Discount Engine Endpoints
 */

/**
 * POST /api/admin/coupons
 * Protected: Create a new marketplace coupon
 */
router.post(
  '/coupons',
  authenticate,
  authorize('admin'),
  validateBody(createCouponSchema),
  CouponController.createCoupon
);

/**
 * GET /api/admin/coupons
 * Protected: List all coupons with search, status filtering, and pagination
 */
router.get(
  '/coupons',
  authenticate,
  authorize('admin'),
  validateQuery(couponQuerySchema),
  CouponController.getCoupons
);

/**
 * GET /api/admin/coupons/:id
 * Protected: Get coupon detail by ID with redemption metrics
 */
router.get(
  '/coupons/:id',
  authenticate,
  authorize('admin'),
  validateParams(couponParamSchema),
  CouponController.getCouponById
);

/**
 * PATCH /api/admin/coupons/:id
 * Protected: Update coupon fields, dates, or active status
 */
router.patch(
  '/coupons/:id',
  authenticate,
  authorize('admin'),
  validateParams(couponParamSchema),
  validateBody(updateCouponSchema),
  CouponController.updateCoupon
);

/**
 * DELETE /api/admin/coupons/:id
 * Protected: Delete unused coupon or deactivate if historical redemptions exist
 */
router.delete(
  '/coupons/:id',
  authenticate,
  authorize('admin'),
  validateParams(couponParamSchema),
  CouponController.deleteCoupon
);

export const adminRoutes = router;

