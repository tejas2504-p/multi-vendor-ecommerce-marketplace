import { z } from 'zod';
import mongoose from 'mongoose';

const objectIdValidator = z.string().refine((val) => mongoose.isValidObjectId(val), {
  message: 'Invalid MongoDB ObjectId format',
});

export const createProductSchema = z
  .object({
    name: z
      .string({ required_error: 'Product name is required' })
      .trim()
      .min(2, 'Product name must be at least 2 characters')
      .max(200, 'Product name cannot exceed 200 characters'),
    description: z
      .string({ required_error: 'Product description is required' })
      .trim()
      .min(10, 'Product description must be at least 10 characters long'),
    price: z
      .number({ required_error: 'Product price is required' })
      .positive('Price must be a positive number greater than zero'),
    categoryId: objectIdValidator,
    stock: z
      .number({ required_error: 'Stock count is required' })
      .int('Stock must be an integer')
      .nonnegative('Stock cannot be negative')
      .default(0),
    images: z.array(z.string().trim()).optional().default([]),
    brand: z.string().trim().max(100).optional().default(''),
    sku: z.string().trim().min(3).max(50).toUpperCase().optional(),
    status: z.enum(['draft', 'active', 'inactive']).optional().default('active'),
  })
  .strict({
    message: 'Unauthorized fields detected. You cannot supply vendorId, role, or administrative fields.',
  });

export const updateProductSchema = z
  .object({
    name: z.string().trim().min(2).max(200).optional(),
    description: z.string().trim().min(10).optional(),
    price: z.number().positive('Price must be greater than zero').optional(),
    categoryId: objectIdValidator.optional(),
    stock: z.number().int().nonnegative('Stock cannot be negative').optional(),
    images: z.array(z.string().trim()).optional(),
    brand: z.string().trim().max(100).optional(),
    sku: z.string().trim().min(3).max(50).toUpperCase().optional(),
    status: z.enum(['draft', 'active', 'inactive']).optional(),
  })
  .strict({
    message: 'Unauthorized fields detected. vendorId or internal system fields cannot be modified.',
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });

export const updateInventorySchema = z
  .object({
    stock: z.number().int().nonnegative('Stock cannot be negative').optional(),
    quantity: z.number().int().optional(),
    mode: z.enum(['set', 'adjust']).optional().default('set'),
  })
  .strict()
  .refine(
    (data) => data.stock !== undefined || data.quantity !== undefined,
    { message: 'Either stock count or adjustment quantity must be provided' }
  );

export const productQuerySchema = z.object({
  categoryId: z.string().optional(),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().positive().optional(),
  search: z.string().trim().optional(),
  status: z.enum(['draft', 'active', 'inactive']).optional(),
  sortBy: z.enum(['price', 'createdAt', 'name']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(12),
});

export const updateProductStatusSchema = z
  .object({
    status: z.enum(['draft', 'active', 'inactive'], {
      required_error: 'Status is required (draft, active, inactive)',
    }),
  })
  .strict();

export const createCategorySchema = z
  .object({
    name: z
      .string({ required_error: 'Category name is required' })
      .trim()
      .min(2, 'Category name must be at least 2 characters')
      .max(80, 'Category name cannot exceed 80 characters'),
    description: z.string().trim().max(500).optional().default(''),
    parentCategory: objectIdValidator.nullable().optional().default(null),
    isActive: z.boolean().optional().default(true),
  })
  .strict();

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type UpdateInventoryInput = z.infer<typeof updateInventorySchema>;
export type ProductQueryInput = z.infer<typeof productQuerySchema>;
export type UpdateProductStatusInput = z.infer<typeof updateProductStatusSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

