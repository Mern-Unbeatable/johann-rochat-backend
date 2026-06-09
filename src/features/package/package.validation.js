import { z } from 'zod';

export const createPackageSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers and hyphens only'),
  price: z.number().positive('Price must be positive'),
  credits: z.number().int().positive('Credits must be a positive integer'),
  pricePerCredit: z.number().positive('Price per credit must be positive'),
  description: z.string().min(10, 'Description must be at least 10 characters').max(500),
  features: z.array(z.string().min(1)).min(1).max(20),
  badge: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
});

export const updatePackageSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  price: z.number().positive().optional(),
  credits: z.number().int().positive().optional(),
  pricePerCredit: z.number().positive().optional(),
  description: z.string().min(10).max(500).optional(),
  features: z.array(z.string().min(1)).min(1).max(20).optional(),
  badge: z.boolean().optional(),
  isActive: z.boolean().optional(),
});