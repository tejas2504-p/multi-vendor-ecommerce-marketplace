import { Router } from 'express';
import { PaymentController } from '../controllers/payment.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/rbac.middleware';
import { validateBody } from '../middlewares/validate.middleware';
import { createPaymentOrderSchema, verifyPaymentSchema } from '../validators/payment.validator';

const router = Router();

// Webhook endpoint (Public, signature-verified via HMAC-SHA256)
router.post('/webhook', PaymentController.handleWebhook);

// Customer endpoints (Protected)
router.post(
  '/create-order',
  authenticate,
  validateBody(createPaymentOrderSchema),
  PaymentController.createOrder
);

router.post(
  '/verify',
  authenticate,
  validateBody(verifyPaymentSchema),
  PaymentController.verifyPayment
);

router.get(
  '/order/:orderId',
  authenticate,
  PaymentController.getPaymentByOrder
);

// Admin endpoints (Protected, Admin only)
router.get(
  '/admin',
  authenticate,
  authorize('admin'),
  PaymentController.getAdminPayments
);

export const paymentRoutes = router;
