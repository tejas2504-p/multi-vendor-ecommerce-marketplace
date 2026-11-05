import { Request, Response, NextFunction } from 'express';
import { CategoryService } from '../services/category.service';
import { ApiResponse } from '../utils/apiResponse';

export class CategoryController {
  /**
   * POST /api/categories
   * Create category (Admin only)
   */
  static create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const category = await CategoryService.createCategory(req.body);
      ApiResponse.created(res, category, 'Category created successfully');
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/categories
   * Public: List all active categories
   */
  static list = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const categories = await CategoryService.listCategories(true);
      ApiResponse.success(res, categories, 'Categories retrieved successfully');
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/categories/:id
   * Public: Get single category by ID
   */
  static getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const category = await CategoryService.getCategoryById(req.params.id);
      ApiResponse.success(res, category, 'Category retrieved successfully');
    } catch (error) {
      next(error);
    }
  };
}

