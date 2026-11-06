import { z } from 'zod';

const mongoIdRegex = /^[0-9a-fA-F]{24}$/;

export const updatePlatformCommissionSchema = z.object({
  rate: z
    .number({ required_error: 'Commission rate is required' })
    .min(0, 'Commission rate cannot be negative')
    .max(100, 'Commission rate cannot exceed 100%'),
});

export const updateVendorCommissionSchema = z.object({
  rate: z
    .number({ required_error: 'Commission rate is required' })
    .min(0, 'Commission rate cannot be negative')
    .max(100, 'Commission rate cannot exceed 100%'),
});

export const requestPayoutSchema = z.object({
  amount: z
    .number({ required_error: 'Payout amount is required' })
    .min(1, 'Payout amount must be at least ₹1'),
  destinationReference: z
    .string({ required_error: 'Destination reference (e.g. UPI ID or Bank Account) is required' })
    .trim()
    .min(3, 'Destination reference must be at least 3 characters'),
  idempotencyKey: z.string().trim().optional(),
});

export const updatePayoutStatusSchema = z.object({
  status: z.enum(['approved', 'processing', 'paid', 'rejected', 'failed'], {
    required_error: 'Target payout status is required',
  }),
  providerReference: z.string().trim().optional(),
  rejectionReason: z.string().trim().optional(),
  failureReason: z.string().trim().optional(),
});

export const rejectPayoutSchema = z.object({
  rejectionReason: z
    .string({ required_error: 'Rejection reason is required' })
    .trim()
    .min(3, 'Rejection reason must be at least 3 characters'),
});

export const payoutFilterSchema = z.object({
  status: z.enum(['requested', 'approved', 'processing', 'paid', 'rejected', 'failed']).optional(),
  vendorId: z.string().regex(mongoIdRegex, 'Invalid vendor ID format').optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export type UpdatePlatformCommissionInput = z.infer<typeof updatePlatformCommissionSchema>;
export type UpdateVendorCommissionInput = z.infer<typeof updateVendorCommissionSchema>;
export type RequestPayoutInput = z.infer<typeof requestPayoutSchema>;
export type UpdatePayoutStatusInput = z.infer<typeof updatePayoutStatusSchema>;
export type RejectPayoutInput = z.infer<typeof rejectPayoutSchema>;
export type PayoutFilterInput = z.infer<typeof payoutFilterSchema>;
