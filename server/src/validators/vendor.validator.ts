import { z } from 'zod';

export const businessAddressSchema = z.object({
  street: z
    .string({ required_error: 'Street address is required' })
    .trim()
    .min(2, 'Street address must be at least 2 characters')
    .max(120, 'Street address cannot exceed 120 characters'),
  city: z
    .string({ required_error: 'City is required' })
    .trim()
    .min(2, 'City must be at least 2 characters')
    .max(60, 'City cannot exceed 60 characters'),
  state: z
    .string({ required_error: 'State or province is required' })
    .trim()
    .min(2, 'State must be at least 2 characters')
    .max(60, 'State cannot exceed 60 characters'),
  postalCode: z
    .string({ required_error: 'Postal / ZIP code is required' })
    .trim()
    .min(2, 'Postal code must be at least 2 characters')
    .max(20, 'Postal code cannot exceed 20 characters'),
  country: z
    .string({ required_error: 'Country is required' })
    .trim()
    .min(2, 'Country must be at least 2 characters')
    .max(60, 'Country cannot exceed 60 characters'),
});

export const applyVendorSchema = z
  .object({
    storeName: z
      .string({ required_error: 'Store name is required' })
      .trim()
      .min(2, 'Store name must be at least 2 characters')
      .max(100, 'Store name cannot exceed 100 characters'),
    description: z
      .string()
      .trim()
      .max(1000, 'Description cannot exceed 1000 characters')
      .optional()
      .default(''),
    businessEmail: z
      .string({ required_error: 'Business email is required' })
      .trim()
      .toLowerCase()
      .email('Please provide a valid business email address'),
    businessPhone: z
      .string({ required_error: 'Business phone is required' })
      .trim()
      .min(5, 'Business phone must be at least 5 digits')
      .max(25, 'Business phone cannot exceed 25 characters'),
    businessAddress: businessAddressSchema,
  })
  .strict({
    message: 'Unknown fields are not permitted in vendor application',
  });

export const updateVendorProfileSchema = z
  .object({
    storeName: z
      .string()
      .trim()
      .min(2, 'Store name must be at least 2 characters')
      .max(100, 'Store name cannot exceed 100 characters')
      .optional(),
    description: z
      .string()
      .trim()
      .max(1000, 'Description cannot exceed 1000 characters')
      .optional(),
    businessEmail: z
      .string()
      .trim()
      .toLowerCase()
      .email('Please provide a valid business email address')
      .optional(),
    businessPhone: z
      .string()
      .trim()
      .min(5, 'Business phone must be at least 5 digits')
      .max(25, 'Business phone cannot exceed 25 characters')
      .optional(),
    businessAddress: businessAddressSchema.partial().optional(),
  })
  .strict({
    message: 'Unauthorized modifications: You cannot modify status, role, rejectionReason, or internal fields',
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    { message: 'At least one field must be provided for update' }
  );

export type ApplyVendorInput = z.infer<typeof applyVendorSchema>;
export type UpdateVendorProfileInput = z.infer<typeof updateVendorProfileSchema>;

