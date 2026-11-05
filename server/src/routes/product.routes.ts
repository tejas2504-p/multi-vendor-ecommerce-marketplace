import { Router } from 'express';
import { authenticate, optionalAuthenticate } from '../middlewares/auth.middleware';
import { requireApprovedVendor } from '../middlewares/vendor.middleware';
import { validateBody, validateQuery } from '../middlewares/validate.middleware';
import {
  createProductSchema,
  updateProductSchema,
  updateInventorySchema,
} from '../validators/product.validator';
import {
  searchProductsQuerySchema,
  searchSuggestionsQuerySchema,
} from '../validators/productSearch.validator';
import { ProductController } from '../controllers/product.controller';
import { ProductSearchController } from '../controllers/productSearch.controller';
import { productImageRoutes } from './productImage.routes';

const router = Router();

/**
 * GET /api/products/search/suggestions
 * Public: Autocomplete search suggestions (Phase 5B)
 */
router.get(
  '/search/suggestions',
  validateQuery(searchSuggestionsQuerySchema),
  ProductSearchController.suggestions
);

/**
 * GET /api/products/search
 * Public: Advanced Elasticsearch product search & filtering (Phase 5B)
 */
router.get(
  '/search',
  validateQuery(searchProductsQuerySchema),
  ProductSearchController.search
);

/**
 * GET /api/products
 * Public: List active products with filters, search & pagination
 */
router.get('/', ProductController.listPublic);

/**
 * GET /api/products/:id
 * Public / Protected: View single product
 */
router.get('/:id', optionalAuthenticate, ProductController.getById);

/**
 * POST /api/products
 * Protected: Approved Vendor only
 */
router.post(
  '/',
  authenticate,
  requireApprovedVendor,
  validateBody(createProductSchema),
  ProductController.create
);

/**
 * PATCH /api/products/:id
 * Protected: Product Owner or Admin
 */
router.patch(
  '/:id',
  authenticate,
  validateBody(updateProductSchema),
  ProductController.update
);

/**
 * DELETE /api/products/:id
 * Protected: Product Owner or Admin (soft deletion)
 */
router.delete('/:id', authenticate, ProductController.delete);

/**
 * PATCH /api/products/:id/inventory
 * Protected: Product Owner or Admin (atomic stock update)
 */
router.patch(
  '/:id/inventory',
  authenticate,
  validateBody(updateInventorySchema),
  ProductController.updateInventory
);

/**
 * /api/products/:id/images — Image management sub-router (Phase 4B)
 */
router.use('/:id/images', productImageRoutes);

export const productRoutes = router;

