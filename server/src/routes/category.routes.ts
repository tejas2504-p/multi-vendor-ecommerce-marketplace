import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/rbac.middleware';
import { validateBody } from '../middlewares/validate.middleware';
import { createCategorySchema } from '../validators/product.validator';
import { CategoryController } from '../controllers/category.controller';

const router = Router();

/**
 * GET /api/categories
 * Public: List active categories
 */
router.get('/', CategoryController.list);

/**
 * GET /api/categories/:id
 * Public: Get single category by ID
 */
router.get('/:id', CategoryController.getById);

/**
 * POST /api/categories
 * Protected: Admin only
 */
router.post(
  '/',
  authenticate,
  authorize('admin'),
  validateBody(createCategorySchema),
  CategoryController.create
);

export const categoryRoutes = router;

