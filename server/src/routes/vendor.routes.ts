import { Router, Request, Response } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/rbac.middleware';
import { authorizeOwnership } from '../middlewares/ownership.middleware';
import { ApiResponse } from '../utils/apiResponse';

const router = Router();

/**
 * GET /api/vendor/dashboard
 * Protected: Requires authenticated user with 'vendor' role
 */
router.get(
  '/dashboard',
  authenticate,
  authorize('vendor'),
  (req: Request, res: Response) => {
    ApiResponse.success(
      res,
      {
        user: req.user,
        portal: 'Vendor Management Hub',
        accessibleFeatures: [
          'Store Profile Management',
          'Product Catalog & Inventory',
          'Sub-Order Fulfillment',
          'Escrow & Payout Statements',
        ],
      },
      'Welcome to your Vendor Dashboard'
    );
  }
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

export const vendorRoutes = router;

