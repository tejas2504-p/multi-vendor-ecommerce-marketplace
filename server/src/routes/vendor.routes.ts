import { Router, Request, Response } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/rbac.middleware';
import { requireApprovedVendor } from '../middlewares/vendor.middleware';
import { authorizeOwnership } from '../middlewares/ownership.middleware';
import { validateBody, validateParams } from '../middlewares/validate.middleware';
import { updateVendorProfileSchema } from '../validators/vendor.validator';
import { updateInventorySchema } from '../validators/product.validator';
import { vendorOrderParamSchema, updateVendorOrderStatusSchema } from '../validators/order.validator';
import { requestPayoutSchema } from '../validators/commission.validator';
import { VendorController } from '../controllers/vendor.controller';
import { ProductController } from '../controllers/product.controller';
import { OrderController } from '../controllers/order.controller';
import { CommissionController } from '../controllers/commission.controller';
import { ApiResponse } from '../utils/apiResponse';

const router = Router();

/**
 * GET /api/vendor/dashboard
 * Protected: Requires authenticated user with approved 'vendor' status
 */
router.get(
  '/dashboard',
  authenticate,
  requireApprovedVendor,
  VendorController.getDashboard
);

/**
 * GET /api/vendor/store
 * Protected: Retrieve approved vendor's own store profile
 */
router.get(
  '/store',
  authenticate,
  requireApprovedVendor,
  VendorController.getStore
);

/**
 * PATCH /api/vendor/store
 * Protected: Update approved vendor's own store details
 */
router.patch(
  '/store',
  authenticate,
  requireApprovedVendor,
  validateBody(updateVendorProfileSchema),
  VendorController.updateStore
);

/**
 * GET /api/vendor/products
 * Protected: List authenticated vendor's owned products
 */
router.get(
  '/products',
  authenticate,
  requireApprovedVendor,
  ProductController.listVendor
);

/**
 * PATCH /api/vendor/products/:id/inventory
 * Protected: Update vendor's product stock
 */
router.patch(
  '/products/:id/inventory',
  authenticate,
  requireApprovedVendor,
  validateBody(updateInventorySchema),
  ProductController.updateInventory
);

/**
 * GET /api/vendor/orders
 * Protected: List authenticated vendor's assigned orders
 */
router.get('/orders', authenticate, requireApprovedVendor, OrderController.getVendorOrders);

/**
 * GET /api/vendor/orders/:vendorOrderId
 * Protected: Retrieve specific vendor order details
 */
router.get(
  '/orders/:vendorOrderId',
  authenticate,
  requireApprovedVendor,
  validateParams(vendorOrderParamSchema),
  OrderController.getVendorOrderById
);

/**
 * PATCH /api/vendor/orders/:vendorOrderId/status
 * Protected: Update status and shipment tracking for vendor order
 */
router.patch(
  '/orders/:vendorOrderId/status',
  authenticate,
  requireApprovedVendor,
  validateParams(vendorOrderParamSchema),
  validateBody(updateVendorOrderStatusSchema),
  OrderController.updateVendorOrderStatus
);

/**
 * GET /api/vendor/resources/:ownerId
 * Protected: Requires 'vendor' or 'admin' role AND ownership of the target resource
 */
router.get(
  '/resources/:ownerId',
  authenticate,
  authorize('vendor', 'admin'),
  authorizeOwnership((req) => req.params.ownerId),
  (req: Request, res: Response) => {
    ApiResponse.success(
      res,
      {
        resourceOwnerId: req.params.ownerId,
        authorizedUser: req.user,
        status: 'Access Granted',
      },
      'Resource accessed successfully by authorized owner'
    );
  }
);

/**
 * Phase 8B: Platform Commission & Vendor Payout Endpoints
 */

/**
 * GET /api/vendor/earnings
 * Protected: Retrieve vendor earnings summary and real-time balances
 */
router.get(
  '/earnings',
  authenticate,
  requireApprovedVendor,
  CommissionController.getEarnings
);

/**
 * GET /api/vendor/transactions
 * Protected: Retrieve paginated transaction ledger
 */
router.get(
  '/transactions',
  authenticate,
  requireApprovedVendor,
  CommissionController.getTransactions
);

/**
 * GET /api/vendor/payouts
 * Protected: Retrieve paginated payout withdrawal requests
 */
router.get(
  '/payouts',
  authenticate,
  requireApprovedVendor,
  CommissionController.getPayouts
);

/**
 * POST /api/vendor/payouts/request
 * Protected: Submit a new payout request with balance reservation
 */
router.post(
  '/payouts/request',
  authenticate,
  requireApprovedVendor,
  validateBody(requestPayoutSchema),
  CommissionController.requestPayout
);

export const vendorRoutes = router;
