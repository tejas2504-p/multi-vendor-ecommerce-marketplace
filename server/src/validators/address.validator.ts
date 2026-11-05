import { z } from 'zod';
import mongoose from 'mongoose';

// Phone regex: optional leading +, followed by digits, spaces, hyphens, parentheses (7 to 20 chars)
const phoneRegex = /^\+?[0-9\s\-\(\)]{7,20}$/;

// Postal code regex: letters, numbers, spaces, hyphens (3 to 20 chars)
const postalCodeRegex = /^[A-Za-z0-9\s\-]{3,20}$/;

export const createAddressSchema = z.object({
  fullName: z
    .string({ required_error: 'Full name is required' })
    .trim()
    .min(2, 'Full name must be at least 2 characters')
    .max(100, 'Full name cannot exceed 100 characters'),
  phone: z
    .string({ required_error: 'Phone number is required' })
    .trim()
    .regex(phoneRegex, 'Please provide a valid phone number (7-20 digits)'),
  addressLine1: z
    .string({ required_error: 'Address line 1 is required' })
    .trim()
    .min(3, 'Address line 1 must be at least 3 characters')
    .max(150, 'Address line 1 cannot exceed 150 characters'),
  addressLine2: z
    .string()
    .trim()
    .max(150, 'Address line 2 cannot exceed 150 characters')
    .optional(),
  city: z
    .string({ required_error: 'City is required' })
    .trim()
    .min(2, 'City must be at least 2 characters')
    .max(100, 'City cannot exceed 100 characters'),
  state: z
    .string({ required_error: 'State or Province is required' })
    .trim()
    .min(2, 'State or Province must be at least 2 characters')
    .max(100, 'State or Province cannot exceed 100 characters'),
  postalCode: z
    .string({ required_error: 'Postal or ZIP code is required' })
    .trim()
    .regex(postalCodeRegex, 'Please provide a valid postal or ZIP code'),
  country: z
    .string({ required_error: 'Country is required' })
    .trim()
    .min(2, 'Country must be at least 2 characters')
    .max(100, 'Country cannot exceed 100 characters')
    .default('United States'),
  isDefault: z.boolean().optional().default(false),
});

export const updateAddressSchema = createAddressSchema.partial();

export const addressParamSchema = z.object({
  id: z
    .string({ required_error: 'Address ID is required' })
    .refine((val) => mongoose.isValidObjectId(val), {
      message: 'Invalid address ID format',
    }),
});

export type CreateAddressInput = z.infer<typeof createAddressSchema>;
export type UpdateAddressInput = z.infer<typeof updateAddressSchema>;

