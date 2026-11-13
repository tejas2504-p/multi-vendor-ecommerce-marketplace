import { z } from 'zod';

export const listInvoicesQuerySchema = z.object({
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
  orderId: z.string().regex(/^[0-9a-fA-F]{24}$/, { message: 'Invalid order ID' }).optional(),
  invoiceType: z.enum(['customer_parent', 'vendor_order']).optional(),
});

export const invoiceIdParamSchema = z.object({
  invoiceId: z.string().regex(/^[0-9a-fA-F]{24}$/, { message: 'Invalid invoice ID format' }),
});

export const orderInvoiceQuerySchema = z.object({
  type: z.enum(['customer_parent', 'vendor_order']).optional(),
  vendorOrderId: z.string().regex(/^[0-9a-fA-F]{24}$/, { message: 'Invalid vendor order ID' }).optional(),
});

export type ListInvoicesQuery = z.infer<typeof listInvoicesQuerySchema>;
export type OrderInvoiceQuery = z.infer<typeof orderInvoiceQuerySchema>;

