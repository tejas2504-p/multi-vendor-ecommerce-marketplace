import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { requireApprovedVendor } from '../middlewares/vendor.middleware';
import { imageUploadMiddleware } from '../middlewares/imageUpload.middleware';
import { ProductImageController } from '../controllers/productImage.controller';

const router = Router({ mergeParams: true }); // mergeParams exposes :id from parent router

/**
 * GET /api/products/:id/images
 * Public: Retrieve product images as presigned URLs
 */
router.get('/', ProductImageController.list);

/**
 * POST /api/products/:id/images
 * Protected: Approved vendor (owner) uploads up to 5 images
 * Field name: "images" (multipart/form-data)
 */
router.post(
  '/',
  authenticate,
  requireApprovedVendor,
  imageUploadMiddleware.array('images', 5),
  ProductImageController.upload
);

/**
 * PUT /api/products/:id/images/:imageId
 * Protected: Owner or admin replaces a single image
 * Field name: "image" (multipart/form-data)
 */
router.put(
  '/:imageId',
  authenticate,
  imageUploadMiddleware.single('image'),
  ProductImageController.replace
);

/**
 * DELETE /api/products/:id/images/:imageId
 * Protected: Owner or admin deletes a single image
 */
router.delete('/:imageId', authenticate, ProductImageController.delete);

export const productImageRoutes = router;

