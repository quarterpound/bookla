import { HTTPException } from 'hono/http-exception';
import { addMinutes } from '@bookla/slots';
import type {
  BookingResponseDto,
  BookingUpdateDto,
  BookingsListQueryDto,
} from '@bookla/dto/bookings';
import { getPrismaClient } from '../../db';
import { AppError } from '../../utils/errors';
import type { AuthUser } from '../../middleware/auth.middleware';

const toDateOnlyUTC = (d: Date): Date =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

const formatDateOnly = (d: Date): string => {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const bookingInclude = {
  staff: { select: { id: true, name: true } },
  service: {
    select: {
      id: true,
      name: true,
      durationMinutes: true,
      priceAmount: true,
      currency: true,
    },
  },
  client: { select: { id: true, name: true, phone: true } },
} as const;

type BookingWithRelations = {
  id: number;
  publicId: string;
  date: Date;
  startTime: string;
  endTime: string;
  status: BookingResponseDto['status'];
  source: BookingResponseDto['source'];
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  staff: { id: number; name: string };
  service: {
    id: number;
    name: string;
    durationMinutes: number;
    priceAmount: number;
    currency: string;
  };
  client: { id: number; name: string; phone: string };
};

const toResponse = (b: BookingWithRelations): BookingResponseDto => ({
  id: b.id,
  publicId: b.publicId,
  date: formatDateOnly(b.date),
  startTime: b.startTime,
  endTime: b.endTime,
  status: b.status,
  source: b.source,
  notes: b.notes,
  staff: b.staff,
  service: b.service,
  client: b.client,
  createdAt: b.createdAt.toISOString(),
  updatedAt: b.updatedAt.toISOString(),
});

export const listBookings = async (
  user: AuthUser,
  query: BookingsListQueryDto,
): Promise<BookingResponseDto[]> => {
  const db = await getPrismaClient();

  // Optional staff filter — if supplied, verify it belongs to the caller's
  // tenant (404 to avoid leaking IDs from other tenants).
  if (query.staffId !== undefined) {
    const staff = await db.staff.findFirst({
      where: { id: query.staffId, tenantId: user.tenantId },
      select: { id: true },
    });
    if (!staff) throw new HTTPException(404, { message: 'Staff not found' });
  }

  const rows = await db.booking.findMany({
    where: {
      tenantId: user.tenantId,
      date: { gte: toDateOnlyUTC(query.from), lte: toDateOnlyUTC(query.to) },
      ...(query.staffId !== undefined && { staffId: query.staffId }),
    },
    include: bookingInclude,
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
  });

  return rows.map(toResponse);
};

export const getBooking = async (
  user: AuthUser,
  id: number,
): Promise<BookingResponseDto> => {
  const db = await getPrismaClient();
  const booking = await db.booking.findFirst({
    where: { id, tenantId: user.tenantId },
    include: bookingInclude,
  });
  if (!booking) throw new HTTPException(404, { message: 'Booking not found' });
  return toResponse(booking);
};

/**
 * PATCH — three orthogonal kinds of edit:
 *   1. `notes` only — trivial.
 *   2. `status` transition — server enforces that only `confirmed` rows can
 *      move to `cancelled | completed | no_show`. Anything else is a 409.
 *   3. Reschedule (`date` + `startTime`) — must run the same atomic conflict
 *      check as the public booking endpoint. We Serializable-wrap it and map
 *      a 40001 to a 409 SLOT_UNAVAILABLE.
 *
 * (2) and (3) can be combined in one PATCH; (1) can combine with anything.
 */
export const updateBooking = async (
  user: AuthUser,
  id: number,
  dto: BookingUpdateDto,
): Promise<BookingResponseDto> => {
  const db = await getPrismaClient();

  const existing = await db.booking.findFirst({
    where: { id, tenantId: user.tenantId },
    select: {
      id: true,
      staffId: true,
      status: true,
      date: true,
      startTime: true,
      endTime: true,
      serviceId: true,
    },
  });
  if (!existing) throw new HTTPException(404, { message: 'Booking not found' });

  const wantsReschedule = dto.date !== undefined && dto.startTime !== undefined;
  const wantsStatus = dto.status !== undefined && dto.status !== existing.status;

  // Status transitions: only confirmed → terminal. We don't currently allow
  // un-cancelling or moving between terminal states; tenants who fat-finger it
  // can re-create the booking manually (task 10).
  if (wantsStatus) {
    if (existing.status !== 'confirmed') {
      throw new AppError(
        `Cannot change status from ${existing.status}`,
        'INVALID_STATUS_TRANSITION',
        409,
      );
    }
    if (dto.status === 'confirmed') {
      throw new AppError(
        'Cannot transition to confirmed',
        'INVALID_STATUS_TRANSITION',
        409,
      );
    }
  }

  // Reschedule path runs in a Serializable tx for the same race protection the
  // public create flow uses (two simultaneous moves into one slot).
  if (wantsReschedule) {
    const service = await db.service.findFirst({
      where: { id: existing.serviceId },
      select: { durationMinutes: true },
    });
    if (!service) throw new HTTPException(404, { message: 'Service not found' });

    const newDate = toDateOnlyUTC(dto.date!);
    const newStart = dto.startTime!;
    const newEnd = addMinutes(newStart, service.durationMinutes);

    const attempt = async () =>
      db.$transaction(
        async (tx) => {
          const conflicts = await tx.booking.count({
            where: {
              staffId: existing.staffId,
              date: newDate,
              status: 'confirmed',
              id: { not: id },
              NOT: {
                OR: [
                  { endTime: { lte: newStart } },
                  { startTime: { gte: newEnd } },
                ],
              },
            },
          });
          if (conflicts > 0) {
            throw new AppError('Slot unavailable', 'SLOT_UNAVAILABLE', 409);
          }

          return tx.booking.update({
            where: { id },
            data: {
              date: newDate,
              startTime: newStart,
              endTime: newEnd,
              ...(wantsStatus && { status: dto.status }),
              ...(dto.notes !== undefined && { notes: dto.notes }),
            },
            include: bookingInclude,
          });
        },
        { isolationLevel: 'Serializable' },
      );

    try {
      const updated = await attempt();
      return toResponse(updated);
    } catch (err) {
      if (isSerializationFailure(err)) {
        throw new AppError('Slot unavailable', 'SLOT_UNAVAILABLE', 409);
      }
      throw err;
    }
  }

  // Non-reschedule path (status and/or notes only). No conflict math needed.
  const updated = await db.booking.update({
    where: { id },
    data: {
      ...(wantsStatus && { status: dto.status }),
      ...(dto.notes !== undefined && { notes: dto.notes }),
    },
    include: bookingInclude,
  });
  return toResponse(updated);
};

const isSerializationFailure = (err: unknown): boolean => {
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
