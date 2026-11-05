import { z } from 'zod';

export const productSearchSortValues = [
  'relevance',
  'price_asc',
  'price_desc',
  'newest',
  'rating',
] as const;

export type ProductSearchSortOption = (typeof productSearchSortValues)[number];

export const searchProductsQuerySchema = z
  .object({
    q: z
      .string()
      .trim()
      .max(200, 'Search keyword cannot exceed 200 characters')
      .optional(),
    category: z
      .string()
      .trim()
      .max(100, 'Category identifier cannot exceed 100 characters')
      .optional(),
    brand: z
      .string()
      .trim()
      .max(100, 'Brand name cannot exceed 100 characters')
      .optional(),
    minPrice: z.coerce
      .number({ invalid_type_error: 'minPrice must be a valid number' })
      .min(0, 'minPrice cannot be negative')
      .optional(),
    maxPrice: z.coerce
      .number({ invalid_type_error: 'maxPrice must be a valid number' })
      .min(0, 'maxPrice cannot be negative')
      .optional(),
    minRating: z.coerce
      .number({ invalid_type_error: 'minRating must be a valid number' })
      .min(0, 'minRating cannot be negative')
      .max(5, 'minRating cannot exceed 5')
      .optional(),
    inStock: z
      .preprocess((val) => {
        if (typeof val === 'string') {
          if (val.toLowerCase() === 'true' || val === '1') return true;
          if (val.toLowerCase() === 'false' || val === '0') return false;
        }
        return val;
      }, z.boolean({ invalid_type_error: 'inStock must be true or false' }))
      .optional(),
    sort: z
      .enum(productSearchSortValues, {
        errorMap: () => ({
          message: `Invalid sort parameter. Supported values: ${productSearchSortValues.join(', ')}`,
        }),
      })
      .default('relevance'),
    page: z.coerce
      .number({ invalid_type_error: 'page must be a valid number' })
      .int('page must be an integer')
      .min(1, 'page must be at least 1')
      .default(1),
    limit: z.coerce
      .number({ invalid_type_error: 'limit must be a valid number' })
      .int('limit must be an integer')
      .min(1, 'limit must be at least 1')
      .max(100, 'limit cannot exceed 100')
      .default(20),
  })
  .refine(
    (data) => {
      if (data.minPrice !== undefined && data.maxPrice !== undefined) {
        return data.minPrice <= data.maxPrice;
      }
      return true;
    },
    {
      message: 'minPrice cannot be greater than maxPrice',
      path: ['minPrice'],
    }
  );

export type SearchProductsQuery = z.infer<typeof searchProductsQuerySchema>;

export const searchSuggestionsQuerySchema = z.object({
  q: z
    .string({ required_error: 'Search query "q" is required' })
    .trim()
    .min(1, 'Search query must contain at least 1 character')
    .max(100, 'Search query cannot exceed 100 characters'),
  limit: z.coerce
    .number({ invalid_type_error: 'limit must be a valid number' })
    .int('limit must be an integer')
    .min(1, 'limit must be at least 1')
    .max(20, 'limit cannot exceed 20')
    .default(8),
});

export type SearchSuggestionsQuery = z.infer<typeof searchSuggestionsQuerySchema>;

