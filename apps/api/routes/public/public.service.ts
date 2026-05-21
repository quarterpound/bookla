import { HTTPException } from 'hono/http-exception';
import { getAvailableSlots, addMinutes } from '@bookla/slots';
import type {
  PublicBookingCreateDto,
  PublicBookingCreatedDto,
  PublicBookingResponseDto,
  PublicBusinessResponseDto,
  PublicCalendarDay,
  PublicCalendarQueryDto,
  PublicSlotsQueryDto,
} from '@bookla/dto/public';
import { getPrismaClient } from '../../db';
import { AppError } from '../../utils/errors';
import {
  formatDateOnly,
  isSerializationFailure,
  jsDayToWorkingDay,
  loadAvailableSlotsForStaff,
  nowInTimezone,
  toDateOnlyUTC,
} from '../bookings/booking-shared';

/** Resolve a public tenant by slug. Surfaces 404 if missing or suspended. */
const requirePublicTenant = async (slug: string) => {
  const db = await getPrismaClient();
  const tenant = await db.tenant.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      address: true,
      phone: true,
      avatarUrl: true,
      timezone: true,
      status: true,
    },
  });
  if (!tenant || tenant.status !== 'active') {
    throw new HTTPException(404, { message: 'Business not found' });
  }
  return tenant;
};

export const getPublicBusiness = async (slug: string): Promise<PublicBusinessResponseDto> => {
  const tenant = await requirePublicTenant(slug);
  const db = await getPrismaClient();

  const [services, staff] = await Promise.all([
    db.service.findMany({
      where: { tenantId: tenant.id, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        name: true,
        durationMinutes: true,
        priceAmount: true,
        currency: true,
      },
    }),
    db.staff.findMany({
      where: { tenantId: tenant.id, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      select: { id: true, name: true, avatarUrl: true },
    }),
  ]);

  return {
    tenant: {
      slug: tenant.slug,
      name: tenant.name,
      description: tenant.description,
      address: tenant.address,
      phone: tenant.phone,
      avatarUrl: tenant.avatarUrl,
      timezone: tenant.timezone,
    },
    services,
    staff,
  };
};

export const getPublicSlots = async (
  slug: string,
  query: PublicSlotsQueryDto,
): Promise<string[]> => {
  const tenant = await requirePublicTenant(slug);
  const db = await getPrismaClient();
  return loadAvailableSlotsForStaff({
    db,
    tenantId: tenant.id,
    staffId: query.staffId,
    serviceId: query.serviceId,
    date: query.date,
    timezone: tenant.timezone,
  });
};

/**
 * Calendar — for each date in `[from, to]`, decide whether the staff has any
 * bookable slot for the given service. Returns the subset of dates that DO
 * (formatted YYYY-MM-DD). Cap the range at 60 days to keep this O(days) and
 * avoid pathological queries.
 *
 * Stays inline (rather than calling `loadAvailableSlotsForStaff` per day) so
 * we issue 3 range queries instead of N×3 single-day queries — the helper is
 * shaped for single-date callers (public/slots + manual booking).
 */
export const getPublicCalendar = async (
  slug: string,
  query: PublicCalendarQueryDto,
): Promise<PublicCalendarDay[]> => {
  const tenant = await requirePublicTenant(slug);
  const db = await getPrismaClient();

  const [service, staff] = await Promise.all([
    db.service.findFirst({
      where: { id: query.serviceId, tenantId: tenant.id, isActive: true },
      select: { id: true, durationMinutes: true },
    }),
    db.staff.findFirst({
      where: { id: query.staffId, tenantId: tenant.id, isActive: true },
      select: { id: true },
    }),
  ]);
  if (!service || !staff) {
    throw new HTTPException(404, { message: 'Service or staff not found' });
  }

  const fromUTC = toDateOnlyUTC(query.from);
  const toUTC = toDateOnlyUTC(query.to);
  if (toUTC < fromUTC) return [];

  const spanDays = Math.round((toUTC.getTime() - fromUTC.getTime()) / 86_400_000) + 1;
  if (spanDays > 60) {
    throw new HTTPException(400, { message: 'Range too large (max 60 days)' });
  }

  const [intervals, daysOff, bookings] = await Promise.all([
    db.workingInterval.findMany({
      where: { staffId: staff.id },
      select: { dayOfWeek: true, startTime: true, endTime: true },
    }),
    db.dayOff.findMany({
      where: { staffId: staff.id, date: { gte: fromUTC, lte: toUTC } },
      select: { date: true },
    }),
    db.booking.findMany({
      where: {
        staffId: staff.id,
        date: { gte: fromUTC, lte: toUTC },
        status: 'confirmed',
      },
      select: { date: true, startTime: true, endTime: true },
    }),
  ]);

  // Bucket reusable per-date inputs for the engine.
  const intervalsByDow = new Map<number, { startTime: string; endTime: string }[]>();
  for (const w of intervals) {
    if (!intervalsByDow.has(w.dayOfWeek)) intervalsByDow.set(w.dayOfWeek, []);
    intervalsByDow.get(w.dayOfWeek)!.push({ startTime: w.startTime, endTime: w.endTime });
  }
  const dayOffSet = new Set(daysOff.map((d) => formatDateOnly(d.date)));
  const bookingsByDate = new Map<string, { startTime: string; endTime: string }[]>();
  for (const b of bookings) {
    const key = formatDateOnly(b.date);
    if (!bookingsByDate.has(key)) bookingsByDate.set(key, []);
    bookingsByDate.get(key)!.push({ startTime: b.startTime, endTime: b.endTime });
  }

  const nowInBusinessTz = nowInTimezone(tenant.timezone);
  const days: PublicCalendarDay[] = [];
  for (
    let cursor = new Date(fromUTC);
    cursor <= toUTC;
    cursor = new Date(cursor.getTime() + 86_400_000)
  ) {
    const dateStr = formatDateOnly(cursor);
    const dow = jsDayToWorkingDay(cursor.getUTCDay());
    const todays = intervalsByDow.get(dow);

    // "Off" covers both an explicit one-time day-off row and the structural
    // case where the staff doesn't work that weekday at all. From the user's
    // POV both mean "the business isn't open this day" — distinguishing them
    // in the legend isn't worth the extra surface area.
    if (dayOffSet.has(dateStr) || !todays || todays.length === 0) {
      days.push({ date: dateStr, status: 'off' });
      continue;
    }

    const dayBookings = bookingsByDate.get(dateStr) ?? [];
    let hasSlot = false;
    for (const wh of todays) {
      const slots = getAvailableSlots({
        date: dateStr,
        isDayOff: false,
        existingBookings: dayBookings,
        serviceDurationMinutes: service.durationMinutes,
        nowInBusinessTz,
        workingHours: { startTime: wh.startTime, endTime: wh.endTime },
      });
      if (slots.length > 0) {
        hasSlot = true;
        break;
      }
    }
    days.push({ date: dateStr, status: hasSlot ? 'open' : 'full' });
  }

  return days;
};

/**
 * Atomic public booking creation. Two callers race the same slot → the
 * Serializable transaction guarantees one commits and the other gets a 40001
 * (Prisma P2034) we map to SLOT_UNAVAILABLE.
 *
 * Inside the tx:
 *   1. Count confirmed conflicts → throw 409 if any.
 *   2. Upsert Client by (tenantId, phone).
 *   3. Create Booking (source=online, status=confirmed) with `publicId` UUID.
 *   4. Create pending Notification(type=confirmation) — task 14 will deliver it.
 */
export const createPublicBooking = async (
  dto: PublicBookingCreateDto,
): Promise<PublicBookingCreatedDto> => {
  const tenant = await requirePublicTenant(dto.slug);
  const db = await getPrismaClient();

  const [service, staff] = await Promise.all([
    db.service.findFirst({
      where: { id: dto.serviceId, tenantId: tenant.id, isActive: true },
      select: { id: true, durationMinutes: true },
    }),
    db.staff.findFirst({
      where: { id: dto.staffId, tenantId: tenant.id, isActive: true },
      select: { id: true },
    }),
  ]);
  if (!service || !staff) {
    throw new HTTPException(404, { message: 'Service or staff not found' });
  }

  const date = toDateOnlyUTC(dto.date);
  const startTime = dto.startTime;
  const endTime = addMinutes(startTime, service.durationMinutes);

  // Refuse bookings whose start is already in the past for the tenant's TZ.
  const now = nowInTimezone(tenant.timezone);
  const dateStr = formatDateOnly(date);
  if (dateStr < now.date || (dateStr === now.date && startTime < now.time)) {
    throw new AppError('Cannot book a past slot', 'SLOT_IN_PAST', 400);
  }

  const attempt = async () =>
    db.$transaction(
      async (tx) => {
        // Block check happens inside the tx so a race with `DELETE /blocked-phones`
        // is impossible — the serialisable isolation will retry if needed.
        const blocked = await tx.blockedPhone.findUnique({
          where: { tenantId_phone: { tenantId: tenant.id, phone: dto.client.phone } },
          select: { id: true },
        });
        if (blocked) {
          // Generic 403 — we intentionally don't reveal that they're blocked.
          // The storefront surfaces a neutral "can't book" message; the actual
          // reason (if any) only ever leaves the API on authed admin endpoints.
          throw new AppError(
            "This phone can't book at this business right now",
            'PHONE_BLOCKED',
            403,
          );
        }

        const conflicts = await tx.booking.count({
          where: {
            staffId: staff.id,
            date,
            status: 'confirmed',
            NOT: {
              OR: [{ endTime: { lte: startTime } }, { startTime: { gte: endTime } }],
            },
          },
        });
        if (conflicts > 0) {
          throw new AppError('Slot unavailable', 'SLOT_UNAVAILABLE', 409);
        }

        const client = await tx.client.upsert({
          where: { tenantId_phone: { tenantId: tenant.id, phone: dto.client.phone } },
          update: {
            name: dto.client.name,
            // Only set email when the new payload provides one — never clobber
            // an existing email with null just because the booker omitted it.
            ...(dto.client.email !== undefined && { email: dto.client.email }),
          },
          create: {
            tenantId: tenant.id,
            name: dto.client.name,
            phone: dto.client.phone,
            email: dto.client.email ?? null,
          },
        });

        const booking = await tx.booking.create({
          data: {
            tenantId: tenant.id,
            staffId: staff.id,
            serviceId: service.id,
            clientId: client.id,
            date,
            startTime,
            endTime,
            status: 'confirmed',
            source: 'online',
            notes: dto.notes ?? null,
          },
          select: { publicId: true, id: true },
        });

        // Task 14 will deliver these; for now record the intent.
        await tx.notification.create({
          data: {
            bookingId: booking.id,
            type: 'confirmation',
            channel: 'sms',
            recipient: dto.client.phone,
            status: 'pending',
          },
        });

        return booking;
      },
      { isolationLevel: 'Serializable' },
    );

  try {
    const booking = await attempt();
    return { publicId: booking.publicId };
  } catch (err) {
    if (isSerializationFailure(err)) {
      throw new AppError('Slot unavailable', 'SLOT_UNAVAILABLE', 409);
    }
    throw err;
  }
};

export const getPublicBooking = async (publicId: string): Promise<PublicBookingResponseDto> => {
  const db = await getPrismaClient();
  const booking = await db.booking.findUnique({
    where: { publicId },
    include: {
      tenant: {
        select: {
          slug: true,
          name: true,
          description: true,
          address: true,
          phone: true,
          avatarUrl: true,
          timezone: true,
        },
      },
      service: {
        select: {
          id: true,
          name: true,
          durationMinutes: true,
          priceAmount: true,
          currency: true,
        },
      },
      staff: { select: { id: true, name: true, avatarUrl: true } },
      client: { select: { name: true, phone: true, email: true } },
    },
  });
  if (!booking) throw new HTTPException(404, { message: 'Booking not found' });

  return {
    booking: {
      publicId: booking.publicId,
      date: formatDateOnly(booking.date),
      startTime: booking.startTime,
      endTime: booking.endTime,
      notes: booking.notes,
    },
    tenant: booking.tenant,
    service: booking.service,
    staff: booking.staff,
    client: booking.client,
  };
};
