import { z } from 'zod';

export const createImprovementRequestSchema = z.object({
  listingId: z.string().uuid('Invalid listing ID'),
  userNote: z
    .string()
    .max(1000, 'Note must be less than 1000 characters')
    .optional(),
});
export const addSuggestionsSchema = z.object({
  suggestions: z
    .array(
      z.object({
        fieldName: z.string().min(1, 'Field name is required'),
        currentValue: z.string().optional(),
        suggestedValue: z.string().min(1, 'Suggested value is required'),
        note: z.string().max(500).optional(),
      })
    )
    .min(1, 'At least one suggestion is required'),
  adminNote: z.string().max(1000).optional(),
  status: z
    .enum(['SUGGESTION_SENT', 'IN_REVIEW'])
    .optional()
    .default('SUGGESTION_SENT'),
});
export const updateImprovementStatusSchema = z.object({
  status: z.enum([
    'PENDING',
    'IN_REVIEW',
    'SUGGESTION_SENT',
    'COMPLETED',
    'REJECTED',
  ]),
  adminNote: z.string().max(1000).optional(),
});

export const applyUserSuggestionSchema = z.object({
  suggestionId: z.string().uuid('Invalid suggestion ID'),
  newValue: z.string().min(1, 'New value is required'),
});