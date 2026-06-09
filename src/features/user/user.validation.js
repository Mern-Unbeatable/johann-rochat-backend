import { z } from 'zod';

export const updateProfileSchema = z
  .object({
    firstName: z
      .string()
      .min(2, 'First name must be at least 2 characters')
      .max(50)
      .regex(
        /^[a-zA-Z\s'-]+$/,
        'First name can only contain letters, spaces, apostrophes, and hyphens',
      )
      .optional()
      .nullable(),
    lastName: z
      .string()
      .min(2, 'Last name must be at least 2 characters')
      .max(50)
      .regex(
        /^[a-zA-Z\s'-]+$/,
        'Last name can only contain letters, spaces, apostrophes, and hyphens',
      )
      .optional()
      .nullable(),
  })
  .refine((data) => data.firstName !== undefined || data.lastName !== undefined, {
    message: 'At least firstName or lastName must be provided',
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(6, 'New password must be at least 6 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'New password must be different from your current password',
    path: ['newPassword'],
  });

export const adjustCreditsSchema = z.object({
  amount: z
    .number({ required_error: 'amount is required' })
    .int('amount must be an integer')
    .refine((val) => val !== 0, { message: 'amount must be non-zero' }),
  type: z.enum(['FREE', 'PURCHASE', 'USAGE', 'REFUND'], {
    required_error: 'type is required',
    invalid_type_error: 'type must be one of: FREE, PURCHASE, USAGE, REFUND',
  }),
  reference: z.string().optional(),
});

export const setVerifiedSchema = z.object({
  isVerified: z.boolean({ required_error: 'isVerified (boolean) is required' }),
});
