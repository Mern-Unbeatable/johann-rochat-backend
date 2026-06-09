import { z } from 'zod';

const PropertyType = z.enum(['APARTMENT', 'HOUSE', 'STUDIO', 'OTHER']);
const PropertyCondition = z.enum(['NEW', 'GOOD', 'RENOVATED', 'TO_RENOVATE']);
const Exposure = z.enum(['NORTH', 'SOUTH', 'EAST', 'WEST', 'MIXED']);

export const createListingSchema = z.object({
  location: z.string().min(2, 'Location is required').max(200),
  propertyType: PropertyType,
  rent: z.number({ required_error: 'Rent is required' }).positive('Rent must be positive'),
  condition: PropertyCondition,
  exposure: Exposure,
  surface: z.number().positive().optional().nullable().transform(val => val === null ? undefined : val),
  rooms: z.number().positive({ required_error: 'Rooms is required' }),
  floor: z.string().max(20).optional().nullable().transform(val => val === null ? undefined : val),
  hasElevator: z.boolean().optional().nullable().transform(val => val === null ? undefined : val),
  charges: z.number().nonnegative().optional().nullable().transform(val => val === null ? undefined : val),
  parkingPrice: z.number().nonnegative().optional().nullable().transform(val => val === null ? undefined : val),
  equipment: z.string().max(1000).optional().nullable().transform(val => val === null ? undefined : val),
  availableFrom: z.string().datetime().optional().nullable(),
  petsAllowed: z.boolean().optional().nullable().transform(val => val === null ? undefined : val),
  proximity: z.string().max(500).optional().nullable().transform(val => val === null ? undefined : val),
  additionalInfo: z.string().max(500).optional().nullable().transform(val => val === null ? undefined : val),
});

export const updateListingSchema = z.object({
  location: z.string().min(2).max(200).optional(),
  propertyType: PropertyType.optional(),
  rent: z.number().positive().optional(),
  condition: PropertyCondition.optional(),
  exposure: Exposure.optional(),
  surface: z.number().positive().optional(),
  rooms: z.number().positive().optional(),
  floor: z.string().max(20).optional(),
  hasElevator: z.boolean().optional(),
  charges: z.number().nonnegative().optional(),
  parkingPrice: z.number().nonnegative().optional(),
  equipment: z.string().max(1000).optional(),
  availableFrom: z.string().datetime().optional().nullable(),
  petsAllowed: z.boolean().optional(),
  proximity: z.string().max(500).optional(),
  additionalInfo: z.string().max(2000).optional(),
});

export const photoSchema = z.object({
  url: z.string().url('Invalid photo URL'),
  order: z.number().int().nonnegative().optional().default(0),
  isPrimary: z.boolean().optional().default(false),
});

export const photosSchema = z.object({
  photos: z
    .array(photoSchema)
    .min(1, 'At least one photo is required')
    .max(10, 'Maximum 10 photos allowed'),
});
