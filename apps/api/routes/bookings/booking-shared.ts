import { HTTPException } from 'hono/http-exception';
import { getAvailableSlots } from '@bookla/slots';
import type { CustomPrismaClient, CustomPrismaTx } from '@bookla/db';

/**
 * Helpers shared by the public storefront endpoints and the authed booking
 * routes. Extracted in task 10 so both flows go through one slot loader and
 * one serialisation-failure predicate.
 */

/** `WorkingInterval.dayOfWeek` is 0=Mon..6=Sun; JS `getDay()` is 0=Sun..6=Sat. */
export const jsDayToWorkingDay = (jsDay: number): number => (jsDay + 6) % 7;

/** Current "date / time" in the business's timezone, formatted YYYY-MM-DD + HH:MM. */
export const nowInTimezone = (timezone: string): { date: string; time: string } => {
  const fmt = new Intl.DateTimeFormat('sv-SE', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = fmt.format(new Date()).split(' ');
  return { date: parts[0]!, time: parts[1]! };
};

export const toDateOnlyUTC = (d: Date): Date =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

export const formatDateOnly = (d: Date): string => {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/**
 * Postgres SQLSTATE 40001 (serialisation failure) detector. Prisma 7 +
 * `@prisma/adapter-pg` surfaces it as a `DriverAdapterError` with
 * `cause.kind = 'TransactionWriteConflict'`. Older Prisma surfaces P2034.
 * Both — plus a textual fallback — are accepted.
 */
export const isSerializationFailure = (err: unknown): boolean => {
  if (!err || typeof err !== 'object') return false;
  const e = err as {
    code?: string;
    message?: string;
    cause?: { kind?: string; originalCode?: string };
  };
  if (e.code === 'P2034') return true;
  if (e.cause?.kind === 'TransactionWriteConflict') return true;
  if (e.cause?.originalCode === '40001') return true;
  if (typeof e.message === 'string' && /could not serialize/i.test(e.message)) return true;
  return false;
};

interface SlotLoaderArgs {
  db: CustomPrismaClient | CustomPrismaTx;
  tenantId: number;
  staffId: number;
  serviceId: number;
  /** Any Date; normalised to UTC date-only inside. */
  date: Date;
  /** Tenant's IANA timezone (e.g. `Asia/Baku`) — drives past-slot filtering. */
  timezone: string;
}

/**
 * Compute available slot start times for a `(tenant, staff, service, date)` —
 * the single source of truth used by both the public slots endpoint and the
 * authed manual-booking slot picker. Returns sorted HH:MM strings.
 *
 * Resolves service + staff scoped to `tenantId` (`isActive=true`); throws 404
 * on a cross-tenant mismatch to avoid leaking IDs. Loads working intervals,
 * days off, and confirmed bookings for the date, then runs the slot engine
 * once per interval (covers split shifts) and dedupes.
 */
export const loadAvailableSlotsForStaff = async ({
  db,
  tenantId,
  staffId,
  serviceId,
  date,
  timezone,
}: SlotLoaderArgs): Promise<string[]> => {
  const [service, staff] = await Promise.all([
    db.service.findFirst({
      where: { id: serviceId, tenantId, isActive: true },
      select: { id: true, durationMinutes: true },
    }),
    db.staff.findFirst({
      where: { id: staffId, tenantId, isActive: true },
      select: { id: true },
    }),
  ]);
  if (!service || !staff) {
    throw new HTTPException(404, { message: 'Service or staff not found' });
  }

  const dateUTC = toDateOnlyUTC(date);
  const dow = jsDayToWorkingDay(dateUTC.getUTCDay());

  const [intervals, dayOff, bookings] = await Promise.all([
    db.workingInterval.findMany({
      where: { staffId: staff.id, dayOfWeek: dow },
      select: { startTime: true, endTime: true },
      orderBy: { startTime: 'asc' },
    }),
    db.dayOff.findFirst({
      where: { staffId: staff.id, date: dateUTC },
      select: { id: true },
    }),
    db.booking.findMany({
      where: { staffId: staff.id, date: dateUTC, status: 'confirmed' },
      select: { startTime: true, endTime: true },
    }),
  ]);

  if (dayOff || intervals.length === 0) return [];

  const nowInBusinessTz = nowInTimezone(timezone);
  const dateStr = formatDateOnly(dateUTC);
  const slots: string[] = [];
  for (const wh of intervals) {
    slots.push(
      ...getAvailableSlots({
        date: dateStr,
        isDayOff: false,
        existingBookings: bookings,
        serviceDurationMinutes: service.durationMinutes,
        nowInBusinessTz,
        workingHours: { startTime: wh.startTime, endTime: wh.endTime },
      }),
    );
  }
  // Adjacent intervals shouldn't overlap (the schedule controller rejects
  // overlap on write), but dedupe defensively.
  return Array.from(new Set(slots)).sort();
};
