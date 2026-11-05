import { z } from 'zod';

const mongoIdRegex = /^[0-9a-fA-F]{24}$/;

export const createPaymentOrderSchema = z.object({
  orderId: z
    .string({ required_error: 'Order ID is required' })
    .regex(mongoIdRegex, 'Invalid order ID format'),
});

export const verifyPaymentSchema = z.object({
  razorpay_order_id: z
    .string({ required_error: 'razorpay_order_id is required' })
    .min(1, 'razorpay_order_id cannot be empty'),
  razorpay_payment_id: z
    .string({ required_error: 'razorpay_payment_id is required' })
    .min(1, 'razorpay_payment_id cannot be empty'),
  razorpay_signature: z
    .string({ required_error: 'razorpay_signature is required' })
    .min(1, 'razorpay_signature cannot be empty'),
});

export const paymentFilterSchema = z.object({
  status: z.enum(['pending', 'authorized', 'captured', 'failed', 'refunded']).optional(),
  customerId: z.string().regex(mongoIdRegex, 'Invalid customer ID format').optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export type CreatePaymentOrderInput = z.infer<typeof createPaymentOrderSchema>;
export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>;
export type PaymentFilterInput = z.infer<typeof paymentFilterSchema>;

