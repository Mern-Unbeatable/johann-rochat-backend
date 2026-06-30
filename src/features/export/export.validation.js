import { z } from 'zod';

export const createExportSchema = z.object({
  listingId: z.string().uuid('Invalid listing ID'),
  generationId: z.string().uuid('Invalid generation ID').optional(),
  type: z.enum(['PDF', 'COPY', 'EMAIL']),
  emailTo: z.string().email('Invalid email').optional(),
}).refine((data) => {
  if (data.type === 'EMAIL' && !data.emailTo) {
    return false;
  }
  return true;
}, { message: 'emailTo is required for EMAIL export', path: ['emailTo'] });