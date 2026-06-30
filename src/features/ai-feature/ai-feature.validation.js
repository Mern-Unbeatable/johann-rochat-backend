import { z } from 'zod';

export const AiFeatureTypeEnum = z.enum([
  'WARMER_TONE',
  'SHORTEN_TEXT',
  'HIGHLIGHT_LOCATION',
  'OPTIMIZE_INVESTORS',
  'OPTIMIZE_AIRBNB',
  'MAKE_PREMIUM',
  'REGENERATE',
  'CUSTOM',
]);

export const applyAiFeatureSchema = z.object({
  listingId: z.string().uuid('Invalid listing ID'),
  generationId: z.string().uuid('Invalid generation ID').optional(),
  feature: AiFeatureTypeEnum,
  customPrompt: z
    .string()
    .optional(),
}).refine(
  (data) => {
    if (data.feature === 'CUSTOM' && !data.customPrompt) return false;
    return true;
  },
  { message: 'customPrompt is required for CUSTOM feature', path: ['customPrompt'] }
);