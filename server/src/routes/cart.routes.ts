import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/rbac.middleware';
import { validateBody, validateParams } from '../middlewares/validate.middleware';
import {
  addToCartSchema,
  updateCartItemSchema,
  cartParamSchema,
} from '../validators/cart.validator';
import { CartController } from '../controllers/cart.controller';

const router = Router();

// All cart operations require authentication and allow customers and platform administrators.
// Vendors are strictly forbidden from modifying or managing customer carts.
router.use(authenticate, authorize('customer', 'admin'));

/**
 * POST /api/cart/add (and /api/cart/items)
 * Add a product to the cart. If already present, increment quantity.
 */
router.post('/add', validateBody(addToCartSchema), CartController.add);
router.post('/items', validateBody(addToCartSchema), CartController.add);

/**
 * GET /api/cart
 * Retrieve the authenticated customer's cart with current prices & totals.
 */
router.get('/', CartController.get);

/**
 * PATCH /api/cart/update/:productId (and /api/cart/items/:productId)
 * Update product quantity in cart.
 */
router.patch(
  '/update/:productId',
  validateParams(cartParamSchema),
  validateBody(updateCartItemSchema),
  CartController.update
);
router.patch(
  '/items/:productId',
  validateParams(cartParamSchema),
  validateBody(updateCartItemSchema),
  CartController.update
);

/**
 * DELETE /api/cart/remove/:productId (and /api/cart/items/:productId)
 * Remove a product from the cart.
 */
router.delete(
  '/remove/:productId',
  validateParams(cartParamSchema),
  CartController.remove
);
router.delete(
  '/items/:productId',
  validateParams(cartParamSchema),
  CartController.remove
);

/**
 * DELETE /api/cart/clear (and DELETE /api/cart)
 * Clear all items from the customer's cart.
 */
router.delete('/clear', CartController.clear);
router.delete('/', CartController.clear);

export const cartRoutes = router;

