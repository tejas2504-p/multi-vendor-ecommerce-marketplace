import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/rbac.middleware';
import { validateBody, validateParams } from '../middlewares/validate.middleware';
import { checkoutSchema, orderIdParamSchema } from '../validators/checkout.validator';
import { CheckoutController } from '../controllers/checkout.controller';

const router = Router();

// Protect all checkout routes: Requires authenticated customer or admin
router.use(authenticate, authorize('customer', 'admin'));

/**
 * POST /api/checkout
 * Converts cart items into an immutable order with stock deduction
 */
router.post('/', validateBody(checkoutSchema), CheckoutController.checkout);

/**
 * GET /api/checkout/orders
 * List authenticated customer's past orders
 */
router.get('/orders', CheckoutController.listOrders);

/**
 * GET /api/checkout/orders/:id
 * Retrieve a specific order by ID
 */
router.get('/orders/:id', validateParams(orderIdParamSchema), CheckoutController.getOrder);

export const checkoutRoutes = router;

