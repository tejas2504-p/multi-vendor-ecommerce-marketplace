import { Router, Request, Response } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/rbac.middleware';
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

export const adminRoutes = router;

