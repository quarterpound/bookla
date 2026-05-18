# 10 — Manual booking flow

The tenant's "I'm taking a phone call" path. Reuses the slot wrapper and the atomic create.

Depends on: **07**, **08**, **09**.

## API

- `POST /bookings` (protected) — manual booking. Same atomic transaction as `POST /public/bookings`, but `source='manual'`. Body: `{ staffId, serviceId, date, startTime, client: { name, phone }, notes? }`. Upserts `Client` by `(tenantId, phone)`.
- `PATCH /bookings/:id` (already in task 09) — covers reschedule, cancel, complete, no-show.

`packages/dto/bookings.ts` — `bookingCreateDto`, `bookingUpdateDto`.

## Dashboard

- `apps/dashboard/src/pages/bookings/new.tsx` — full-screen pushed route. Steps: pick staff (skip if 1) → pick service → pick date → pick slot (uses `getSlotsForStaffDate` via `GET /bookings/slots?...` or shared endpoint) → enter client name + phone → submit.
- `apps/dashboard/src/pages/bookings/$id.tsx` — full-screen detail. Shows client name/phone, service, date/time, status. Actions: reschedule, cancel, mark complete, mark no-show. Reschedule reopens a slot picker.

Add a protected `GET /bookings/available-slots?staffId&serviceId&date` (or reuse `/public/business/:slug/slots` with the tenant's own slug) so the manual flow doesn't duplicate slot logic.

## Acceptance

- Manual booking with overlap is rejected with `SLOT_UNAVAILABLE`.
- Successful manual booking appears immediately on the calendar (task 09 view).
- Reschedule moves the booking; cancel sets status; no-show sets status. All visible on the day view.
- Client gets upserted (no duplicate `Client` rows for the same `(tenantId, phone)`).
