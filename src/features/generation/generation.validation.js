import { z } from 'zod';

export const generateAdSchema = z.object({
  listingId: z.string().uuid('Invalid listing ID'),
});

export const aiFeatureSchema = z.object({
  listingId: z.string().uuid('Invalid listing ID'),
  generationId: z.string().uuid('Invalid generation ID'),
  feature: z.enum([
    'WARMER_TONE',
    'SHORTEN_TEXT',
    'HIGHLIGHT_LOCATION',
    'OPTIMIZE_INVESTORS',
    'OPTIMIZE_AIRBNB',
    'MAKE_PREMIUM',
    'REGENERATE',
    'CUSTOM',
  ]),
  customPrompt: z.string().min(10).max(1000).optional(),
}).refine(
  (data) => {
    if (data.feature === 'CUSTOM' && !data.customPrompt) return false;
    return true;
  },
  { message: 'customPrompt is required when feature is CUSTOM', path: ['customPrompt'] }
);

export const updateGenerationTextSchema = z.object({
  text: z.string().min(10, 'Text must be at least 10 characters').max(10000, 'Text is too long'),
});