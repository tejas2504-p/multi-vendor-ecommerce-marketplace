import { Request, Response, NextFunction } from 'express';
import { ProductService } from '../services/product.service';
import { ProductIndexingService } from '../services/productIndexing.service';
import { ApiResponse } from '../utils/apiResponse';
import { productQuerySchema } from '../validators/product.validator';

export class ProductController {
  /**
   * POST /api/products
   * Create product (Approved Vendor only)
   */
  static create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const product = await ProductService.createProduct(req.user!.id, req.body);
      ApiResponse.created(res, product, 'Product created successfully');
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/products
   * Public: List active products with filters, search, and pagination
   */
  static listPublic = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = productQuerySchema.parse(req.query);
      const result = await ProductService.listPublicProducts(query);
      ApiResponse.success(res, result.products, 'Products retrieved successfully', 200, result.meta);
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/products/:id
   * Public: Get single product by ID
   */
  static getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const product = await ProductService.getProductById(
        req.params.id,
        req.user?.id,
        req.user?.role
      );
      ApiResponse.success(res, product, 'Product retrieved successfully');
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/vendor/products
   * Vendor: List owned products
   */
  static listVendor = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = productQuerySchema.parse(req.query);
      const result = await ProductService.listVendorProducts(req.user!.id, query);
      ApiResponse.success(res, result.products, 'Vendor products retrieved successfully', 200, result.meta);
    } catch (error) {
      next(error);
    }
  };

  /**
   * PATCH /api/products/:id
   * Update product (Owner Vendor or Admin)
   */
  static update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const product = await ProductService.updateProduct(
        req.params.id,
        req.user!.id,
        req.user!.role,
        req.body
      );
      ApiResponse.success(res, product, 'Product updated successfully');
    } catch (error) {
      next(error);
    }
  };

  /**
   * DELETE /api/products/:id
   * Soft-delete product (Owner Vendor or Admin)
   */
  static delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await ProductService.deleteProduct(req.params.id, req.user!.id, req.user!.role);
      ApiResponse.success(res, null, 'Product deleted successfully');
    } catch (error) {
      next(error);
    }
  };

  /**
   * PATCH /api/products/:id/inventory
   * Update inventory stock (Owner Vendor or Admin)
   */
  static updateInventory = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const product = await ProductService.updateInventory(
        req.params.id,
        req.user!.id,
        req.user!.role,
        req.body
      );
      ApiResponse.success(res, product, 'Product inventory updated successfully');
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/admin/products
   * Admin: List all products across vendors
   */
  static adminList = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = productQuerySchema.parse(req.query);
      const result = await ProductService.adminListProducts(query);
      ApiResponse.success(res, result.products, 'Admin products list retrieved successfully', 200, result.meta);
    } catch (error) {
      next(error);
    }
  };

  /**
   * PATCH /api/admin/products/:id/status
   * Admin: Activate/deactivate/moderate product
   */
  static adminUpdateStatus = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const product = await ProductService.adminUpdateProductStatus(
        req.params.id,
        req.body.status
      );
      ApiResponse.success(res, product, 'Product status updated successfully');
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/admin/products/reindex
   * Admin: Bulk reindex all products from MongoDB into Elasticsearch
   */
  static adminReindex = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const recreate = Boolean(req.body?.recreate);
      const batchSize = Number(req.body?.batchSize) || 100;
      const report = await ProductIndexingService.reindexAllProducts(recreate, batchSize);
      ApiResponse.success(res, report, 'Bulk reindex operation completed', 200);
    } catch (error) {
      next(error);
    }
  };
}

