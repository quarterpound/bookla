import { z } from 'zod';

export const paginationDto = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(50),
});

export const paginatedSearch = paginationDto.extend({
  search: z.string().optional(),
});

export type PaginationResponse<T> = {
  data: T[];
  count: number;
  filteredCount: number;
};

export const passwordValidator = z
  .string()
  .min(8, 'Password must be at least 8 characters long');

export const emailValidator = z
  .string()
  .trim()
  .toLowerCase()
  .email('Invalid email address');

/**
 * E.164 phone normalizer. Accepts inputs with spaces/dashes/parens; produces
 * `+<digits>` (e.g. `+994501234567`). 8–15 digits per E.164. Rejects anything
 * outside that range. AZ numbers (`+994XXXXXXXXX`) are the primary use case
 * but we don't pin the country code here — Bookla may go cross-border later.
 */
export const phoneValidator = z
  .string()
  .trim()
  .transform((raw) => {
    const stripped = raw.replace(/[\s\-().]/g, '');
    if (stripped.startsWith('+')) return '+' + stripped.slice(1).replace(/\D/g, '');
    return '+' + stripped.replace(/\D/g, '');
  })
  .refine((v) => /^\+\d{8,15}$/.test(v), {
    message: 'Invalid phone number (expected E.164, e.g. +994501234567)',
  });

export const slugValidator = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Slug must be at least 3 characters')
  .max(50, 'Slug must be at most 50 characters')
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug may only contain lowercase letters, numbers, and dashes');

export const idValidator = z.object({ id: z.coerce.number().int().positive() });

export const emptyStringToUndefined = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess(
    (val) => (typeof val === 'string' && val.trim() === '' ? undefined : val),
    schema,
  );
