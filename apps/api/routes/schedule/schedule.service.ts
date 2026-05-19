import { HTTPException } from 'hono/http-exception';
import { getPrismaClient } from '../../db';
import { AppError } from '../../utils/errors';
import type { AuthUser } from '../../middleware/auth.middleware';
import type {
  DayOffCreateDto,
  DaysOffQueryDto,
  WorkingIntervalsWeekDto,
} from '@bookla/dto/schedule';

/**
 * Resolve and authorize a staff row by `(tenantId, staffId)`. Throws 404 if
 * the row doesn't exist OR belongs to a different tenant. Returning 404 (not
 * 403) is intentional — we don't want to leak existence to cross-tenant probes.
 */
const requireStaffForUser = async (user: AuthUser, staffId: number) => {
  const db = await getPrismaClient();
  const staff = await db.staff.findFirst({
    where: { id: staffId, tenantId: user.tenantId },
    select: { id: true },
  });
  if (!staff) throw new HTTPException(404, { message: 'Staff not found' });
  return staff;
};

export const listWorkingIntervals = async (user: AuthUser, staffId: number) => {
  await requireStaffForUser(user, staffId);
  const db = await getPrismaClient();
  return db.workingInterval.findMany({
    where: { staffId },
    orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
  });
};

/**
 * Idempotent week replace. Inside a transaction: delete all intervals for the
 * staff, then insert the new set. Overlap is checked in JS — Postgres has no
 * range-overlap operator on text columns, and the check is cheap.
 */
export const replaceWorkingIntervals = async (
  user: AuthUser,
  staffId: number,
  intervals: WorkingIntervalsWeekDto,
) => {
  await requireStaffForUser(user, staffId);

  // Group by dayOfWeek, sort by startTime, check no overlap.
  const byDay = new Map<number, { startTime: string; endTime: string }[]>();
  for (const i of intervals) {
    if (!byDay.has(i.dayOfWeek)) byDay.set(i.dayOfWeek, []);
    byDay.get(i.dayOfWeek)!.push({ startTime: i.startTime, endTime: i.endTime });
  }
  for (const list of byDay.values()) {
    list.sort((a, b) => a.startTime.localeCompare(b.startTime));
    for (let i = 1; i < list.length; i++) {
      if (list[i]!.startTime < list[i - 1]!.endTime) {
        throw new AppError('Overlapping intervals on the same day', 'OVERLAPPING_INTERVALS', 400);
      }
    }
  }

  const db = await getPrismaClient();
  await db.$transaction(async (tx) => {
    await tx.workingInterval.deleteMany({ where: { staffId } });
    if (intervals.length > 0) {
      await tx.workingInterval.createMany({
        data: intervals.map((i) => ({
          staffId,
          dayOfWeek: i.dayOfWeek,
          startTime: i.startTime,
          endTime: i.endTime,
        })),
      });
    }
  });

  return listWorkingIntervals(user, staffId);
};

export const listDaysOff = async (user: AuthUser, staffId: number, range: DaysOffQueryDto) => {
  await requireStaffForUser(user, staffId);
  const db = await getPrismaClient();
  return db.dayOff.findMany({
    where: {
      staffId,
      ...(range.from && { date: { gte: range.from } }),
      ...(range.to && { date: { lte: range.to } }),
    },
    orderBy: { date: 'asc' },
  });
};

export const createDayOff = async (user: AuthUser, dto: DayOffCreateDto) => {
  await requireStaffForUser(user, dto.staffId);
  const db = await getPrismaClient();
  try {
    return await db.dayOff.create({
      data: {
        staffId: dto.staffId,
        date: dto.date,
        reason: dto.reason,
      },
    });
  } catch (err) {
    // Unique constraint on (staffId, date) — already taken.
    if ((err as { code?: string }).code === 'P2002') {
      throw new AppError('Day-off already exists for that date', 'DAY_OFF_EXISTS', 409);
    }
    throw err;
  }
};

export const deleteDayOff = async (user: AuthUser, id: number) => {
  // Authorize via the staff this day-off belongs to.
  const db = await getPrismaClient();
  const row = await db.dayOff.findUnique({
    where: { id },
    select: { id: true, staffId: true },
  });
  if (!row) throw new HTTPException(404, { message: 'Day-off not found' });
  await requireStaffForUser(user, row.staffId);
  await db.dayOff.delete({ where: { id } });
  return { ok: true } as const;
};
