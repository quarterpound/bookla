import { z } from 'zod';

/**
 * Authenticated booking DTOs — calendar range query + per-booking PATCH.
 * The public-side counterparts live in `./public.ts`. Status enum is duplicated
 * here as a string union rather than importing `@bookla/db` so this package
 * stays runtime-free for the storefront bundle.
 */

const timeHHMM = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be HH:MM (24h)')
  .refine((v) => Number(v.slice(3, 5)) % 15 === 0, {
    message: 'Time must be on a 15-minute boundary',
  });

export const bookingStatusValues = [
  'confirmed',
  'cancelled',
  'completed',
  'no_show',
] as const;
export type BookingStatusValue = (typeof bookingStatusValues)[number];

/**
 * Cap the range at 60 days — matches the public calendar endpoint and keeps
 * the query response bounded for the day/week-view fetches.
 */
export const bookingsListQueryDto = z
  .object({
    from: z.coerce.date(),
    to: z.coerce.date(),
    staffId: z.coerce.number().int().positive().optional(),
  })
  .refine((v) => v.to >= v.from, {
    message: 'to must be on or after from',
    path: ['to'],
  })
  .refine(
    (v) =>
      Math.round((v.to.getTime() - v.from.getTime()) / 86_400_000) + 1 <= 60,
    { message: 'Range too large (max 60 days)', path: ['to'] },
  );

/**
 * PATCH body. All fields optional, but the controller rejects an empty body
 * with a 400. Reschedule = both `date` and `startTime` provided (one without
 * the other is meaningless and the service refuses it).
 */
export const bookingUpdateDto = z
  .object({
    status: z.enum(bookingStatusValues),
    notes: z.string().trim().max(500).nullable(),
    date: z.coerce.date(),
    startTime: timeHHMM,
  })
  .partial()
  .refine(
    (v) =>
      v.status !== undefined ||
      v.notes !== undefined ||
      v.date !== undefined ||
      v.startTime !== undefined,
    { message: 'At least one field must be provided' },
  )
  .refine(
    (v) => (v.date === undefined) === (v.startTime === undefined),
    { message: 'Reschedule requires both date and startTime' },
  );

export type BookingsListQueryDto = z.infer<typeof bookingsListQueryDto>;
export type BookingUpdateDto = z.infer<typeof bookingUpdateDto>;

export interface BookingResponseDto {
  id: number;
  publicId: string;
  date: string; // YYYY-MM-DD
  startTime: string;
  endTime: string;
  status: BookingStatusValue;
  source: 'online' | 'manual';
  notes: string | null;
  staff: { id: number; name: string };
  service: {
    id: number;
    name: string;
    durationMinutes: number;
    priceAmount: number;
    currency: string;
  };
  client: { id: number; name: string; phone: string };
  createdAt: string;
  updatedAt: string;
}
