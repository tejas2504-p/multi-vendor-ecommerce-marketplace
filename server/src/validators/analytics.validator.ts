import { z } from 'zod';

export const analyticsQuerySchema = z.object({
  startDate: z
    .string()
    .datetime({ offset: true })
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .optional(),
  endDate: z
    .string()
    .datetime({ offset: true })
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .optional(),
  period: z.enum(['7d', '30d', '90d', '12m']).optional(),
  groupBy: z.enum(['daily', 'weekly', 'monthly', 'yearly']).optional(),
  refresh: z
    .string()
    .optional()
    .transform((val) => val === 'true' || val === '1'),
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .refine((val) => !isNaN(val) && val >= 1, { message: 'Page must be an integer >= 1' }),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20))
    .refine((val) => !isNaN(val) && val >= 1 && val <= 100, { message: 'Limit must be between 1 and 100' }),
  vendorId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, { message: 'Invalid vendor ID format' })
    .optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;

