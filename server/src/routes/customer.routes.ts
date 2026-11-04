import { Router, Request, Response } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/rbac.middleware';
import { ApiResponse } from '../utils/apiResponse';

const router = Router();

/**
 * GET /api/customer/dashboard
 * Protected: Requires authenticated user with 'customer' role
 */
router.get(
  '/dashboard',
  authenticate,
  authorize('customer'),
  (req: Request, res: Response) => {
    ApiResponse.success(
      res,
      {
        user: req.user,
        portal: 'Customer Storefront & Account Portal',
        accessibleFeatures: [
          'Order History',
          'Delivery Tracking',
          'Saved Addresses',
          'Cart & Checkout',
          'Verified Product Reviews',
        ],
      },
      'Welcome to your Customer Dashboard'
    );
  }
);

export const customerRoutes = router;

