import { z } from 'zod';

/**
 * Schedule DTOs — work intervals (recurring weekly) + days off (one-off dates).
 *
 * A WorkingInterval row is one work window for a staff on a given day-of-week.
 * Multiple rows per (staffId, dayOfWeek) are expected — that's how split shifts
 * (e.g. 09:30–10:30 then 12:30–14:30) are represented.
 */

// Minutes must align to SLOT_INTERVAL_MINUTES (15). Working hours not aligned
// to 15-min boundaries produces nonsensical slot math downstream in task 07's
// slot engine, so we hard-enforce it at the API boundary.
const timeStringValidator = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be HH:MM (24h)')
  .refine((v) => Number(v.slice(3, 5)) % 15 === 0, {
    message: 'Time must be on a 15-minute boundary',
  });

export const workingIntervalDto = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: timeStringValidator,
    endTime: timeStringValidator,
  })
  .refine((v) => v.endTime > v.startTime, {
    message: 'endTime must be after startTime',
    path: ['endTime'],
  });

// Bound on total rows: 7 days × 6 intervals/day max is a sane upper limit.
// Anything beyond that is almost always a UI mistake.
export const workingIntervalsWeekDto = z.array(workingIntervalDto).max(7 * 6);

export const workingIntervalResponseDto = z.object({
  id: z.number(),
  staffId: z.number(),
  dayOfWeek: z.number(),
  startTime: z.string(),
  endTime: z.string(),
});

export const dayOffCreateDto = z.object({
  staffId: z.number().int().positive(),
  date: z.coerce.date(),
  reason: z.string().trim().max(200).optional(),
});

export const dayOffResponseDto = z.object({
  id: z.number(),
  staffId: z.number(),
  date: z.string(),
  reason: z.string().nullable(),
});

export const daysOffQueryDto = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type WorkingIntervalDto = z.infer<typeof workingIntervalDto>;
export type WorkingIntervalsWeekDto = z.infer<typeof workingIntervalsWeekDto>;
export type WorkingIntervalResponseDto = z.infer<typeof workingIntervalResponseDto>;
export type DayOffCreateDto = z.infer<typeof dayOffCreateDto>;
export type DayOffResponseDto = z.infer<typeof dayOffResponseDto>;
export type DaysOffQueryDto = z.infer<typeof daysOffQueryDto>;
