import mongoose from 'mongoose';
import { Category, ICategory } from '../models/category.model';
import { CreateCategoryInput } from '../validators/product.validator';
import { AppError } from '../utils/apiError';
import { slugify } from '../utils/slug';

export class CategoryService {
  /**
   * Create a new category (Admin or initial seed)
   */
  static async createCategory(input: CreateCategoryInput): Promise<ICategory> {
    const slug = slugify(input.name);

    const existingCategory = await Category.findOne({
      $or: [{ name: input.name }, { slug }],
    });

    if (existingCategory) {
      throw AppError.conflict(`Category with name '${input.name}' or slug '${slug}' already exists`);
    }

    if (input.parentCategory) {
      const parent = await Category.findById(input.parentCategory);
      if (!parent) {
        throw AppError.badRequest('Parent category not found');
      }
    }

    const category = await Category.create({
      name: input.name,
      slug,
      description: input.description,
      parentCategory: input.parentCategory || null,
      isActive: input.isActive ?? true,
    });

    return category;
  }

  /**
   * List categories (active by default for storefront)
   */
  static async listCategories(activeOnly: boolean = true): Promise<ICategory[]> {
    const filter = activeOnly ? { isActive: true } : {};
    return Category.find(filter).populate('parentCategory', 'name slug').sort({ name: 1 });
  }

  /**
   * Get category by ID
   */
  static async getCategoryById(id: string): Promise<ICategory> {
    if (!mongoose.isValidObjectId(id)) {
      throw AppError.badRequest('Invalid category ID format');
    }

    const category = await Category.findById(id).populate('parentCategory', 'name slug');
    if (!category) {
      throw AppError.notFound('Category not found');
    }

    return category;
  }
}

