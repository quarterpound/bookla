import { z } from 'zod';
import { SLOT_INTERVAL_MINUTES } from '@bookla/slots';

/**
 * Service DTOs. Price is stored as integer qəpik (1 AZN = 100 qəpik).
 * Duration is in minutes and must align with the slot engine's interval.
 */

const nameField = z.string().trim().min(1, 'Name is required').max(80);
const durationField = z
  .number()
  .int()
  .positive()
  .max(8 * 60)
  .refine((v) => v % SLOT_INTERVAL_MINUTES === 0, {
    message: `Duration must be a multiple of ${SLOT_INTERVAL_MINUTES} minutes`,
  });
const priceField = z.number().int().nonnegative();
const currencyField = z.string().trim().min(1).max(8).default('AZN');
const sortOrderField = z.number().int().nonnegative();

export const serviceCreateDto = z.object({
  name: nameField,
  durationMinutes: durationField,
  priceAmount: priceField,
  currency: currencyField.optional(),
  sortOrder: sortOrderField.optional(),
});

export const serviceUpdateDto = z
  .object({
    name: nameField,
    durationMinutes: durationField,
    priceAmount: priceField,
    currency: currencyField,
    sortOrder: sortOrderField,
    isActive: z.boolean(),
  })
  .partial();

export const serviceResponseDto = z.object({
  id: z.number(),
  name: z.string(),
  durationMinutes: z.number(),
  priceAmount: z.number(),
  currency: z.string(),
  isActive: z.boolean(),
  sortOrder: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type ServiceCreateDto = z.infer<typeof serviceCreateDto>;
export type ServiceUpdateDto = z.infer<typeof serviceUpdateDto>;
export type ServiceResponseDto = z.infer<typeof serviceResponseDto>;
