import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/rbac.middleware';
import { validateParams } from '../middlewares/validate.middleware';
import { orderParamSchema } from '../validators/order.validator';
import { OrderController } from '../controllers/order.controller';

const router = Router();

// Protect customer order routes: Requires authenticated customer or admin
router.use(authenticate, authorize('customer', 'admin'));

/**
 * GET /api/orders
 * List authenticated customer's parent orders
 */
router.get('/', OrderController.getCustomerOrders);

/**
 * GET /api/orders/:orderId
 * Retrieve details of a customer's specific order
 */
router.get('/:orderId', validateParams(orderParamSchema), OrderController.getCustomerOrderById);

/**
 * GET /api/orders/:orderId/vendor-orders
 * Retrieve child vendor orders & fulfillment tracking for a customer's order
 */
router.get(
  '/:orderId/vendor-orders',
  validateParams(orderParamSchema),
  OrderController.getCustomerVendorOrders
);

export const orderRoutes = router;

