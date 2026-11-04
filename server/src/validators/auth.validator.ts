import { z } from 'zod';

export const registerSchema = z.object({
  name: z
    .string({ required_error: 'Name is required' })
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(60, 'Name cannot exceed 60 characters'),
  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .toLowerCase()
    .email('Please provide a valid email address'),
  password: z
    .string({ required_error: 'Password is required' })
    .min(8, 'Password must be at least 8 characters long')
    .max(72, 'Password cannot exceed 72 characters')
    .regex(
      /^(?=.*[A-Za-z])(?=.*\d|.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).+$/,
      'Password must contain at least one letter and at least one number or special character'
    ),
  role: z
    .literal('customer', {
      errorMap: () => ({
        message: 'Public registration only creates customer accounts. Vendor onboarding and administrative accounts cannot be self-registered.',
      }),
    })
    .optional()
    .default('customer'),
});

export const loginSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .toLowerCase()
    .email('Please provide a valid email address'),
  password: z
    .string({ required_error: 'Password is required' })
    .min(1, 'Password is required'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
