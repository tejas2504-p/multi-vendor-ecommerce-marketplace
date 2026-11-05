import { z } from 'zod';
import mongoose from 'mongoose';

export const updateVendorOrderStatusSchema = z
  .object({
    status: z.enum(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'], {
      required_error: 'Order status is required',
    }),
    trackingNumber: z.string().trim().max(100).optional(),
    carrier: z.string().trim().max(100).optional(),
    note: z.string().trim().max(250).optional(),
    cancellationReason: z.string().trim().max(250).optional(),
  })
  .refine(
    (data) => {
      // If marking as shipped, tracking number or carrier is required when updating shipment
      if (data.status === 'shipped') {
        return Boolean(data.trackingNumber?.trim() || data.carrier?.trim());
      }
      return true;
    },
    {
      message: 'Tracking number or shipping carrier is required when marking an order as shipped',
      path: ['trackingNumber'],
    }
  );

export const adminUpdateOrderStatusSchema = z.object({
  status: z.enum(
    [
      'pending',
      'confirmed',
      'processing',
      'shipped',
      'partially_shipped',
      'partially_delivered',
      'delivered',
      'cancelled',
    ],
    { required_error: 'Order status is required' }
  ),
  note: z.string().trim().max(250).optional(),
});

export const orderParamSchema = z.object({
  orderId: z
    .string({ required_error: 'Order ID is required' })
    .refine((val) => mongoose.isValidObjectId(val), {
      message: 'Invalid order ID format',
    }),
});

export const vendorOrderParamSchema = z.object({
  vendorOrderId: z
    .string({ required_error: 'Vendor Order ID is required' })
    .refine((val) => mongoose.isValidObjectId(val), {
      message: 'Invalid vendor order ID format',
    }),
});

export type UpdateVendorOrderStatusInput = z.infer<typeof updateVendorOrderStatusSchema>;
export type AdminUpdateOrderStatusInput = z.infer<typeof adminUpdateOrderStatusSchema>;

