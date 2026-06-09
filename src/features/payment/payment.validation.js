import { z } from 'zod';

export const createCheckoutSchema = z.object({
  listingId: z.string().uuid().optional(),
  type: z.enum(['LISTING_UNLOCK', 'PACKAGE', 'IMPROVEMENT_REQUEST']),
  packageId: z.string().uuid().optional(),
  improvementRequestId: z.string().uuid().optional(),
});

export const createImprovementPaymentSchema = z.object({
  listingId: z.string().uuid().optional(),
  userNote: z.string().max(1000).optional(),
});