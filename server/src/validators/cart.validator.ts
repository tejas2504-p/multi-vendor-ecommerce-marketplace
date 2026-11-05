import { z } from 'zod';
import mongoose from 'mongoose';

const objectIdValidator = z.string({ required_error: 'Product ID is required' })
  .trim()
  .refine((val) => mongoose.isValidObjectId(val), {
    message: 'Invalid product ID format',
  });

export const addToCartSchema = z
  .object({
    productId: objectIdValidator,
    quantity: z
      .number({ invalid_type_error: 'Quantity must be a number' })
      .int('Quantity must be an integer count')
      .min(1, 'Quantity must be at least 1')
      .default(1),
  })
  .strict({
    message: 'Unauthorized fields detected in add-to-cart payload',
  });

export const updateCartItemSchema = z
  .object({
    quantity: z
      .number({
        required_error: 'Quantity is required',
        invalid_type_error: 'Quantity must be a number',
      })
      .int('Quantity must be an integer count')
      .min(1, 'Quantity must be at least 1'),
  })
  .strict({
    message: 'Unauthorized fields detected in update-cart payload',
  });

export const cartParamSchema = z.object({
  productId: objectIdValidator,
});

export type AddToCartInput = z.infer<typeof addToCartSchema>;
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;

