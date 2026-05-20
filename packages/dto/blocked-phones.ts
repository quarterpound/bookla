import { z } from 'zod';
import { phoneValidator } from './utils';

/**
 * Authenticated CRUD on the per-tenant phone blocklist. The booking endpoint
 * checks this list inside the same serialisable transaction as the conflict
 * check, so adding/removing entries takes effect immediately without any
 * client-side cache shenanigans.
 */
export const blockedPhoneCreateDto = z.object({
  phone: phoneValidator,
  reason: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
});

export const blockedPhoneResponseDto = z.object({
  id: z.number(),
  phone: z.string(),
  reason: z.string().nullable(),
  blockedByUserId: z.number().nullable(),
  createdAt: z.string(),
});

export type BlockedPhoneCreateDto = z.infer<typeof blockedPhoneCreateDto>;
export type BlockedPhoneResponseDto = z.infer<typeof blockedPhoneResponseDto>;
