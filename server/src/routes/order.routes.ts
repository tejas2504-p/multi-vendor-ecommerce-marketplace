import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/rbac.middleware';
import { validateParams } from '../middlewares/validate.middleware';
import { orderParamSchema } from '../validators/order.validator';
import { OrderController } from '../controllers/order.controller';
import { InvoiceController } from '../controllers/invoice.controller';

const router = Router();

// Protect customer order routes: Requires authenticated user
router.use(authenticate, authorize('customer', 'vendor', 'admin'));

/**
 * GET /api/orders
 * List authenticated customer's parent orders
 */
router.get('/', authorize('customer', 'admin'), OrderController.getCustomerOrders);

/**
 * GET /api/orders/:orderId
 * Retrieve details of a customer's specific order
 */
router.get('/:orderId', authorize('customer', 'admin'), validateParams(orderParamSchema), OrderController.getCustomerOrderById);

/**
 * GET /api/orders/:orderId/vendor-orders
 * Retrieve child vendor orders & fulfillment tracking for a customer's order
 */
router.get(
  '/:orderId/vendor-orders',
  authorize('customer', 'admin'),
  validateParams(orderParamSchema),
  OrderController.getCustomerVendorOrders
);

/**
 * GET /api/orders/:orderId/invoice
 * Retrieve or on-demand generate the customer / vendor invoice for this order
 */
router.get('/:orderId/invoice', InvoiceController.getOrderInvoice);

export const orderRoutes = router;


