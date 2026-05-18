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

export const idValidator = z.object({ id: z.coerce.number().int().positive() });

export const emptyStringToUndefined = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess(
    (val) => (typeof val === 'string' && val.trim() === '' ? undefined : val),
    schema,
  );
