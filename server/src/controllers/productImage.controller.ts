import { Request, Response, NextFunction } from 'express';
import {
  uploadProductImages,
  replaceProductImage,
  deleteProductImage,
  getProductImagesWithUrls,
} from '../services/productImage.service';
import { ApiResponse } from '../utils/apiResponse';

export class ProductImageController {
  /**
   * POST /api/products/:id/images
   * Upload one or more images to a product.
   * Access: Approved vendor (owner) only.
   */
  static upload = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const files = req.files as Express.Multer.File[];
      const images = await uploadProductImages(
        req.params.id,
        req.user!.id,
        req.user!.role,
        files
      );
      ApiResponse.created(res, { images }, `${images.length} image(s) uploaded successfully`);
    } catch (error) {
      next(error);
    }
  };

  /**
   * PUT /api/products/:id/images/:imageId
   * Replace a single product image.
   * Access: Product owner or admin.
   */
  static replace = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const file = req.file as Express.Multer.File;
      if (!file) {
        res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'An image file is required.' } });
        return;
      }
      const image = await replaceProductImage(
        req.params.id,
        req.params.imageId,
        req.user!.id,
        req.user!.role,
        file
      );
      ApiResponse.success(res, { image }, 'Image replaced successfully');
    } catch (error) {
      next(error);
    }
  };

  /**
   * DELETE /api/products/:id/images/:imageId
   * Delete a single product image.
   * Access: Product owner or admin.
   */
  static delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await deleteProductImage(
        req.params.id,
        req.params.imageId,
        req.user!.id,
        req.user!.role
      );
      ApiResponse.success(res, null, 'Image deleted successfully');
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/products/:id/images
   * Retrieve product images as short-lived presigned GET URLs.
   * Access: Public (uses product visibility rules from product service).
   */
  static list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const images = await getProductImagesWithUrls(req.params.id);
      ApiResponse.success(res, { images }, 'Product images retrieved successfully');
    } catch (error) {
      next(error);
    }
  };
}

