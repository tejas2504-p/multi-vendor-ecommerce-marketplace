import { Router, Request, Response } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/rbac.middleware';
import { requireApprovedVendor } from '../middlewares/vendor.middleware';
import { authorizeOwnership } from '../middlewares/ownership.middleware';
import { validateBody } from '../middlewares/validate.middleware';
import { updateVendorProfileSchema } from '../validators/vendor.validator';
import { VendorController } from '../controllers/vendor.controller';
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
