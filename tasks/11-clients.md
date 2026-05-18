# 11 — Client list

Auto-populated from bookings. Read-mostly; only notes are editable.

Depends on: **08**, **10** (clients get created there).

## API — `apps/api/routes/clients/`

- `GET /clients?q=&page=&pageSize=` — list + search by name/phone substring.
- `GET /clients/:id` — detail with booking history (most recent first).
- `PATCH /clients/:id` — **notes only**. Name/phone come from bookings; not user-editable here.

DTO: `packages/dto/clients.ts` with `clientUpdateDto = { notes: string | null }`.

## Dashboard

- `apps/dashboard/src/pages/(tabs)/clients.tsx` — list with search box. Empty state with copy "Clients show up here after the first booking."
- `apps/dashboard/src/pages/clients/$id.tsx` — name, phone, free-form notes (auto-save on blur), and a list of past + upcoming bookings.

## Acceptance

- Booking a new client (via public or manual flow) makes them appear in the list.
- Search filters by name OR phone substring.
- Notes persist on blur and survive reload.
- Cross-tenant isolation verified.
