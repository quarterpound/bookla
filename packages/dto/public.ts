import { z } from 'zod';
import { phoneValidator, slugValidator } from './utils';

/**
 * Public-facing booking DTOs — no auth required at the API boundary. Each
 * request is keyed by the business `slug`, which is the only stable public
 * identifier a client knows.
 */

const timeHHMM = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be HH:MM (24h)');

export const publicSlugParamDto = z.object({
  slug: slugValidator,
});

export const publicSlotsQueryDto = z.object({
  staffId: z.coerce.number().int().positive(),
  serviceId: z.coerce.number().int().positive(),
  date: z.coerce.date(),
});

export const publicCalendarQueryDto = z.object({
  staffId: z.coerce.number().int().positive(),
  serviceId: z.coerce.number().int().positive(),
  from: z.coerce.date(),
  to: z.coerce.date(),
});

/**
 * Per-date calendar status. The storefront uses this to render an explanation
 * on disabled cells:
 *   - `open` — has at least one bookable slot; cell is clickable.
 *   - `off`  — no working hours for that weekday OR an explicit day-off row.
 *              Practical meaning to the user is the same; we don't distinguish
 *              the two in the UI to keep the legend small.
 *   - `full` — operates that day but every slot is taken or already past.
 */
export type PublicCalendarStatus = 'open' | 'off' | 'full';

export interface PublicCalendarDay {
  date: string; // YYYY-MM-DD
  status: PublicCalendarStatus;
}

// Optional email: empty string from a form submission should be treated as
// "not provided", not "invalid email". Hence the preprocess.
const optionalEmail = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  z.string().trim().toLowerCase().email('Invalid email address').optional(),
);

export const publicBookingCreateDto = z.object({
  slug: slugValidator,
  staffId: z.number().int().positive(),
  serviceId: z.number().int().positive(),
  date: z.coerce.date(),
  startTime: timeHHMM,
  client: z.object({
    name: z.string().trim().min(1, 'Name is required').max(120),
    phone: phoneValidator,
    email: optionalEmail,
  }),
  notes: z.string().trim().max(500).optional(),
});

export const publicPublicIdParamDto = z.object({
  publicId: z.string().uuid('Invalid booking id'),
});

export type PublicSlugParamDto = z.infer<typeof publicSlugParamDto>;
export type PublicSlotsQueryDto = z.infer<typeof publicSlotsQueryDto>;
export type PublicCalendarQueryDto = z.infer<typeof publicCalendarQueryDto>;
export type PublicBookingCreateDto = z.infer<typeof publicBookingCreateDto>;
export type PublicPublicIdParamDto = z.infer<typeof publicPublicIdParamDto>;

export interface PublicBusinessTenant {
  slug: string;
  name: string;
  description: string | null;
  address: string | null;
  phone: string | null;
  avatarUrl: string | null;
  timezone: string;
}

export interface PublicBusinessService {
  id: number;
  name: string;
  durationMinutes: number;
  priceAmount: number;
  currency: string;
}

export interface PublicBusinessStaff {
  id: number;
  name: string;
  avatarUrl: string | null;
}

export interface PublicBusinessResponseDto {
  tenant: PublicBusinessTenant;
  services: PublicBusinessService[];
  staff: PublicBusinessStaff[];
}

export interface PublicBookingResponseDto {
  booking: {
    publicId: string;
    date: string;
    startTime: string;
    endTime: string;
    notes: string | null;
  };
  tenant: PublicBusinessTenant;
  service: PublicBusinessService;
  staff: PublicBusinessStaff;
  client: { name: string; phone: string; email: string | null };
}

export interface PublicBookingCreatedDto {
  publicId: string;
}
