import { z } from 'zod';
import mongoose from 'mongoose';

export const checkoutSchema = z.object({
  addressId: z
    .string({ required_error: 'Delivery address ID is required' })
    .refine((val) => mongoose.isValidObjectId(val), {
      message: 'Invalid delivery address ID format',
    }),
  idempotencyKey: z
    .string()
    .trim()
    .min(8, 'Idempotency key must be at least 8 characters')
    .max(128, 'Idempotency key cannot exceed 128 characters')
    .optional(),
  couponCode: z
    .string()
    .trim()
    .min(1)
    .max(30)
    .transform((val) => val.toUpperCase())
    .optional(),
});

export const orderIdParamSchema = z.object({
  id: z
    .string({ required_error: 'Order ID is required' })
    .refine((val) => mongoose.isValidObjectId(val), {
      message: 'Invalid order ID format',
    }),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

