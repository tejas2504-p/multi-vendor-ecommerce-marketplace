import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { validateBody } from '../middlewares/validate.middleware';
import { applyVendorSchema, updateVendorProfileSchema } from '../validators/vendor.validator';
import { VendorController } from '../controllers/vendor.controller';

const router = Router();

/**
 * POST /api/vendors/apply
 * Apply for vendor onboarding (Requires authenticated customer account)
 */
router.post(
  '/apply',
  authenticate,
  validateBody(applyVendorSchema),
  VendorController.apply
);

/**
 * GET /api/vendors/me (and /profile/me alias)
 * Fetch authenticated user's vendor profile
 */
router.get('/me', authenticate, VendorController.getProfile);
router.get('/profile/me', authenticate, VendorController.getProfile);

/**
 * PATCH /api/vendors/me (and /profile/me alias)
 * Update permitted store information
 */
router.patch(
  '/me',
  authenticate,
  validateBody(updateVendorProfileSchema),
  VendorController.updateProfile
);
router.patch(
  '/profile/me',
  authenticate,
  validateBody(updateVendorProfileSchema),
  VendorController.updateProfile
);

/**
 * GET /api/vendors/status
 * Get application review status
 */
router.get('/status', authenticate, VendorController.getStatus);

export const vendorProfileRoutes = router;

