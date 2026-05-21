import { HTTPException } from 'hono/http-exception';
import type {
  ClientDetailDto,
  ClientListItemDto,
  ClientUpdateDto,
  ClientsListQueryDto,
} from '@bookla/dto/clients';
import type { BookingResponseDto } from '@bookla/dto/bookings';
import type { PaginationResponse } from '@bookla/dto';
import { getPrismaClient } from '../../db';
import type { AuthUser } from '../../middleware/auth.middleware';
import { formatDateOnly } from '../bookings/booking-shared';

/** Same booking projection the bookings service uses for the calendar. */
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

const bookingToResponse = (b: {
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
}): BookingResponseDto => ({
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

/**
 * Paginated, search-filtered list. Search matches `name` OR `phone` substring
 * (ILIKE). For each client we also surface `bookingCount` + `lastBookingAt`
 * so the list rows have useful right-side metadata without N+1 queries — done
 * via a single groupBy over the bookings table scoped to the tenant.
 */
export const listClients = async (
  user: AuthUser,
  query: ClientsListQueryDto,
): Promise<PaginationResponse<ClientListItemDto>> => {
  const db = await getPrismaClient();
  const search = query.search?.trim();
  const skip = (query.page - 1) * query.limit;

  const where = {
    tenantId: user.tenantId,
    ...(search && {
      OR: [
        { name: { contains: search, mode: 'insensitive' as const } },
        { phone: { contains: search } },
      ],
    }),
  };

  const [rows, filteredCount, count] = await Promise.all([
    db.client.findMany({
      where,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      skip,
      take: query.limit,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        notes: true,
        createdAt: true,
      },
    }),
    db.client.count({ where }),
    db.client.count({ where: { tenantId: user.tenantId } }),
  ]);

  // Bookings aggregate keyed by clientId, scoped to the rows we're returning.
  const ids = rows.map((r) => r.id);
  const bookingAggregates =
    ids.length === 0
      ? []
      : await db.booking.groupBy({
          by: ['clientId'],
          where: { tenantId: user.tenantId, clientId: { in: ids } },
          _count: { _all: true },
          _max: { date: true },
        });
  const aggByClient = new Map<number, { count: number; lastDate: Date | null }>();
  for (const a of bookingAggregates) {
    aggByClient.set(a.clientId, {
      count: a._count._all,
      lastDate: a._max.date ?? null,
    });
  }

  return {
    data: rows.map((r) => {
      const agg = aggByClient.get(r.id);
      return {
        id: r.id,
        name: r.name,
        phone: r.phone,
        email: r.email,
        notes: r.notes,
        bookingCount: agg?.count ?? 0,
        // lastBookingAt is the booking's `date` (UTC-midnight) — we don't have
        // a precise "last visit" time available, and date is what the dashboard
        // actually wants to surface (e.g. "last seen on 12 May 2026").
        lastBookingAt: agg?.lastDate?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
      };
    }),
    filteredCount,
    count,
  };
};

export const getClient = async (user: AuthUser, id: number): Promise<ClientDetailDto> => {
  const db = await getPrismaClient();
  const client = await db.client.findFirst({
    where: { id, tenantId: user.tenantId },
  });
  if (!client) throw new HTTPException(404, { message: 'Client not found' });

  const bookings = await db.booking.findMany({
    where: { tenantId: user.tenantId, clientId: id },
    include: bookingInclude,
    orderBy: [{ date: 'desc' }, { startTime: 'desc' }],
    take: 100, // cap; clients with longer history get the most recent 100
  });

  return {
    id: client.id,
    name: client.name,
    phone: client.phone,
    email: client.email,
    notes: client.notes,
    bookingCount: bookings.length, // bounded by the take cap, but acceptable for a detail page
    lastBookingAt: bookings[0]?.date.toISOString() ?? null,
    createdAt: client.createdAt.toISOString(),
    bookings: bookings.map(bookingToResponse),
  };
};

/**
 * Notes-only update. Name + phone come from the bookings that created the
 * client row; the dashboard can't edit them here (task 11 spec). `null`
 * clears the notes field.
 */
export const updateClient = async (
  user: AuthUser,
  id: number,
  dto: ClientUpdateDto,
): Promise<ClientDetailDto> => {
  const db = await getPrismaClient();
  const result = await db.client.updateMany({
    where: { id, tenantId: user.tenantId },
    data: { notes: dto.notes },
  });
  if (result.count === 0) throw new HTTPException(404, { message: 'Client not found' });
  return getClient(user, id);
};
