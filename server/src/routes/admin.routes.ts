import { Router, Request, Response } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/rbac.middleware';
import { validateBody } from '../middlewares/validate.middleware';
import { rejectVendorSchema } from '../validators/vendor.validator';
import { updateProductStatusSchema } from '../validators/product.validator';
import { AdminVendorController } from '../controllers/adminVendor.controller';
import { ProductController } from '../controllers/product.controller';
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

export const adminRoutes = router;

