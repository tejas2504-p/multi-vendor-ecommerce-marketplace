import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { validateBody } from '../middlewares/validate.middleware';
import { validateCouponSchema } from '../validators/coupon.validator';
import { CouponController } from '../controllers/coupon.controller';

const router = Router();

/**
 * POST /api/coupons/validate
 * Authenticated customer validates a coupon code against active cart
 */
router.post(
  '/validate',
  authenticate,
  validateBody(validateCouponSchema),
  CouponController.validateCoupon
);

export const couponRoutes = router;

