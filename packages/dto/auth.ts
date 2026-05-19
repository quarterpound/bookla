import { z } from 'zod';
import { phoneValidator, slugValidator } from './utils';

export const sendOtpDto = z.object({
  phone: phoneValidator,
});

export const verifyOtpDto = z.object({
  phone: phoneValidator,
  code: z.string().trim().regex(/^\d{6}$/, 'Code must be 6 digits'),
});

const timeStringValidator = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be HH:MM (24h)')
  .refine((v) => Number(v.slice(3, 5)) % 15 === 0, {
    message: 'Time must be on a 15-minute boundary',
  });

// Onboarding sends one work interval per selected day. Split-shift editing
// lives in the Schedule screen post-onboarding (see packages/dto/schedule.ts).
const workingHoursEntryDto = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: timeStringValidator,
  endTime: timeStringValidator,
});

export const onboardingDto = z.object({
  businessName: z.string().trim().min(2, 'Business name is required').max(120),
  slug: slugValidator,
  ownerName: z.string().trim().min(1).max(80).optional(),
  firstService: z.object({
    name: z.string().trim().min(1).max(80),
    durationMinutes: z.number().int().positive().max(8 * 60),
    priceAmount: z.number().int().nonnegative(),
  }),
  workingHours: z.array(workingHoursEntryDto).min(1).max(7),
});

export const meResponseDto = z.object({
  user: z.object({
    id: z.number(),
    phone: z.string(),
    name: z.string().nullable(),
    avatarUrl: z.string().nullable(),
    role: z.string(),
    subRole: z.string(),
  }),
  tenant: z
    .object({
      id: z.number(),
      name: z.string(),
      slug: z.string(),
      plan: z.string(),
      timezone: z.string(),
    })
    .nullable(),
});

export type SendOtpDto = z.infer<typeof sendOtpDto>;
export type VerifyOtpDto = z.infer<typeof verifyOtpDto>;
export type OnboardingDto = z.infer<typeof onboardingDto>;
export type WorkingHoursEntryDto = z.infer<typeof workingHoursEntryDto>;
export type MeResponseDto = z.infer<typeof meResponseDto>;
