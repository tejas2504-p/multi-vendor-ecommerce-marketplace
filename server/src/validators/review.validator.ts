import { z } from 'zod';

const mongoIdRegex = /^[0-9a-fA-F]{24}$/;

export const createReviewSchema = z.object({
  rating: z
    .number({ required_error: 'Rating is required' })
    .int('Rating must be an integer')
    .min(1, 'Rating must be at least 1 star')
    .max(5, 'Rating cannot exceed 5 stars'),
  title: z
    .string({ required_error: 'Review title is required' })
    .trim()
    .min(2, 'Review title must be at least 2 characters')
    .max(120, 'Review title cannot exceed 120 characters'),
  comment: z
    .string({ required_error: 'Review comment is required' })
    .trim()
    .min(5, 'Review comment must be at least 5 characters')
    .max(2000, 'Review comment cannot exceed 2000 characters'),
});

export const updateReviewSchema = z.object({
  rating: z
    .number()
    .int('Rating must be an integer')
    .min(1, 'Rating must be at least 1 star')
    .max(5, 'Rating cannot exceed 5 stars')
    .optional(),
  title: z
    .string()
    .trim()
    .min(2, 'Review title must be at least 2 characters')
    .max(120, 'Review title cannot exceed 120 characters')
    .optional(),
  comment: z
    .string()
    .trim()
    .min(5, 'Review comment must be at least 5 characters')
    .max(2000, 'Review comment cannot exceed 2000 characters')
    .optional(),
});

export const reviewQuerySchema = z.object({
  rating: z.coerce.number().int().min(1).max(5).optional(),
  sort: z
    .enum(['newest', 'oldest', 'highest_rated', 'lowest_rated', 'most_helpful'])
    .optional()
    .default('newest'),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
});

export const adminReviewQuerySchema = z.object({
  status: z.enum(['pending', 'approved', 'hidden', 'rejected']).optional(),
  productId: z.string().regex(mongoIdRegex, 'Invalid Product ID format').optional(),
  userId: z.string().regex(mongoIdRegex, 'Invalid User ID format').optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const updateReviewModerationSchema = z.object({
  status: z.enum(['pending', 'approved', 'hidden', 'rejected'], {
    required_error: 'Moderation status is required',
  }),
  moderationReason: z.string().trim().optional(),
});

export const reviewParamSchema = z.object({
  reviewId: z.string().regex(mongoIdRegex, 'Invalid review ID format'),
});

export const productReviewParamSchema = z.object({
  productId: z.string().regex(mongoIdRegex, 'Invalid product ID format'),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type UpdateReviewInput = z.infer<typeof updateReviewSchema>;
export type ReviewQueryInput = z.infer<typeof reviewQuerySchema>;
export type AdminReviewQueryInput = z.infer<typeof adminReviewQuerySchema>;
export type UpdateReviewModerationInput = z.infer<typeof updateReviewModerationSchema>;

