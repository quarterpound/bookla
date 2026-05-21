import { z } from 'zod';
import { paginatedSearch } from './utils';
import type { BookingResponseDto } from './bookings';

/**
 * Clients are auto-created by both the public booking flow and the manual
 * booking flow (upsert by `(tenantId, phone)`). They are read-mostly here —
 * only `notes` is editable from the dashboard. Name + phone trace back to
 * whatever the latest booking carried.
 */

export const clientsListQueryDto = paginatedSearch;
export type ClientsListQueryDto = z.infer<typeof clientsListQueryDto>;

export const clientUpdateDto = z.object({
  notes: z.string().trim().max(2000).nullable(),
});
export type ClientUpdateDto = z.infer<typeof clientUpdateDto>;

export interface ClientListItemDto {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  bookingCount: number;
  lastBookingAt: string | null; // ISO timestamp, or null if no bookings yet
  createdAt: string;
}

export interface ClientDetailDto extends ClientListItemDto {
  /** Most recent first. Includes cancelled / no-show rows so the tenant can
   *  see the full pattern of behaviour, not just successful visits. */
  bookings: BookingResponseDto[];
}
