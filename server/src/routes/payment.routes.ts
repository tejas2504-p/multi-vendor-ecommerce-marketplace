import { Router } from 'express';
import { PaymentController } from '../controllers/payment.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/rbac.middleware';
import { validateBody } from '../middlewares/validate.middleware';
import { paymentLimiter } from '../middlewares/rateLimiter.middleware';
import {
  createPaymentOrderSchema,
  verifyPaymentSchema,
  createQrCodeSchema,
  simulateQrPaymentSchema,
} from '../validators/payment.validator';

const router = Router();

// Webhook endpoint (Public, signature-verified via HMAC-SHA256)
router.post('/webhook', PaymentController.handleWebhook);

// Customer endpoints (Protected)
router.post(
  '/create-order',
  authenticate,
  paymentLimiter,
  validateBody(createPaymentOrderSchema),
  PaymentController.createOrder
);

router.post(
  '/verify',
  authenticate,
  paymentLimiter,
  validateBody(verifyPaymentSchema),
  PaymentController.verifyPayment
);

router.get(
  '/order/:orderId',
  authenticate,
  PaymentController.getPaymentByOrder
);

// UPI Dynamic QR-Code Endpoints (Protected)
router.post(
  '/create-qr-code',
  authenticate,
  paymentLimiter,
  validateBody(createQrCodeSchema),
  PaymentController.createQrCode
);

router.get(
  '/qr-status/:orderId',
  authenticate,
  PaymentController.getQrStatus
);

router.post(
  '/cancel-qr',
  authenticate,
  PaymentController.cancelQrCode
);

router.post(
  '/simulate-qr',
  authenticate,
  paymentLimiter,
  validateBody(simulateQrPaymentSchema),
  PaymentController.simulateQrPayment
);

// Admin endpoints (Protected, Admin only)
router.get(
  '/admin',
  authenticate,
  authorize('admin'),
  PaymentController.getAdminPayments
);

export const paymentRoutes = router;
