import { z } from 'zod';
import mongoose from 'mongoose';

const objectIdValidator = z
  .string()
  .refine((val) => mongoose.isValidObjectId(val), {
    message: 'Invalid ObjectId format',
  });

export const createCouponSchema = z
  .object({
    code: z
      .string({ required_error: 'Coupon code is required' })
      .trim()
      .min(3, 'Coupon code must be at least 3 characters')
      .max(30, 'Coupon code cannot exceed 30 characters')
      .regex(/^[A-Za-z0-9_-]+$/, 'Coupon code can only contain letters, numbers, hyphens, and underscores')
      .transform((val) => val.toUpperCase()),
    description: z
      .string({ required_error: 'Coupon description is required' })
      .trim()
      .min(3, 'Description must be at least 3 characters')
      .max(300, 'Description cannot exceed 300 characters'),
    discountType: z.enum(['percentage', 'fixed'], {
      required_error: 'Discount type is required and must be "percentage" or "fixed"',
    }),
    discountValue: z
      .number({ required_error: 'Discount value is required' })
      .positive('Discount value must be greater than zero'),
    maximumDiscountAmount: z
      .number()
      .positive('Maximum discount amount must be greater than zero')
      .optional()
      .nullable(),
    minimumOrderAmount: z
      .number()
      .min(0, 'Minimum order amount cannot be negative')
      .optional()
      .default(0),
    startDate: z.coerce.date({ required_error: 'Start date is required' }),
    expiryDate: z.coerce.date({ required_error: 'Expiry date is required' }),
    totalUsageLimit: z
      .number()
      .int('Total usage limit must be an integer')
      .positive('Total usage limit must be at least 1')
      .optional()
      .nullable(),
    perUserUsageLimit: z
      .number()
      .int('Per-user usage limit must be an integer')
      .min(1, 'Per-user usage limit must be at least 1')
      .optional()
      .default(1),
    applicableProducts: z.array(objectIdValidator).optional().default([]),
    applicableCategories: z.array(objectIdValidator).optional().default([]),
    applicableVendors: z.array(objectIdValidator).optional().default([]),
    isActive: z.boolean().optional().default(true),
  })
  .superRefine((data, ctx) => {
    // Percentage discount cannot exceed 100%
    if (data.discountType === 'percentage' && data.discountValue > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['discountValue'],
        message: 'Percentage discount cannot exceed 100%',
      });
    }

    // Start date must be before expiry date
    if (data.startDate >= data.expiryDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['expiryDate'],
        message: 'Expiry date must be after start date',
      });
    }
  });

export const updateCouponSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(3, 'Coupon code must be at least 3 characters')
      .max(30, 'Coupon code cannot exceed 30 characters')
      .regex(/^[A-Za-z0-9_-]+$/, 'Coupon code can only contain letters, numbers, hyphens, and underscores')
      .transform((val) => val.toUpperCase())
      .optional(),
    description: z
      .string()
      .trim()
      .min(3, 'Description must be at least 3 characters')
      .max(300, 'Description cannot exceed 300 characters')
      .optional(),
    discountType: z.enum(['percentage', 'fixed']).optional(),
    discountValue: z.number().positive('Discount value must be greater than zero').optional(),
    maximumDiscountAmount: z.number().positive().optional().nullable(),
    minimumOrderAmount: z.number().min(0).optional(),
    startDate: z.coerce.date().optional(),
    expiryDate: z.coerce.date().optional(),
    totalUsageLimit: z.number().int().positive().optional().nullable(),
    perUserUsageLimit: z.number().int().min(1).optional(),
    applicableProducts: z.array(objectIdValidator).optional(),
    applicableCategories: z.array(objectIdValidator).optional(),
    applicableVendors: z.array(objectIdValidator).optional(),
    isActive: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.discountType === 'percentage' && data.discountValue !== undefined && data.discountValue > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['discountValue'],
        message: 'Percentage discount cannot exceed 100%',
      });
    }

    if (data.startDate && data.expiryDate && data.startDate >= data.expiryDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['expiryDate'],
        message: 'Expiry date must be after start date',
      });
    }
  });

export const couponQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional(),
  status: z.enum(['all', 'active', 'inactive', 'expired']).default('all'),
  discountType: z.enum(['all', 'percentage', 'fixed']).default('all'),
});

export const validateCouponSchema = z.object({
  couponCode: z
    .string({ required_error: 'Coupon code is required' })
    .trim()
    .min(1, 'Coupon code cannot be empty')
    .max(30, 'Coupon code cannot exceed 30 characters')
    .transform((val) => val.toUpperCase()),
  cartId: objectIdValidator.optional(),
  orderId: objectIdValidator.optional(),
});

export const couponParamSchema = z.object({
  id: objectIdValidator,
});

export type CreateCouponInput = z.infer<typeof createCouponSchema>;
export type UpdateCouponInput = z.infer<typeof updateCouponSchema>;
export type CouponQueryInput = z.infer<typeof couponQuerySchema>;
export type ValidateCouponInput = z.infer<typeof validateCouponSchema>;

