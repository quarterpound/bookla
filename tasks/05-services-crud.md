# 05 — Services CRUD

Simplest domain. Establishes the controller/service/DTO + mobile-page pattern that the next 8 tasks follow.

Depends on: **01**, **02**, **03**, **04**.

## API — `apps/api/routes/services/`

- `GET /services` — list active + inactive for the caller's tenant, sorted by `sortOrder`.
- `POST /services` — create.
- `GET /services/:id` — read.
- `PATCH /services/:id` — update name/duration/price/sortOrder/isActive.
- `DELETE /services/:id` — **soft-deactivate** (`isActive=false`). Hard delete is forbidden because past `Booking.serviceId` rows reference it.

All routes scoped by `c.get('user').tenantId`. Use the existing `authMiddleware`.

## DTO — `packages/dto/services.ts`

- `serviceCreateDto`, `serviceUpdateDto`. `priceAmount` is qəpik (integer). `durationMinutes` must be a multiple of `SLOT_INTERVAL_MINUTES` (15) — but defer the multiple-of-15 check to task **07** when `packages/slots` exports the constant. For now, require positive integer.
- Re-export from `packages/dto/index.ts`.

## Dashboard

- `apps/dashboard/src/pages/services/index.tsx` — list view inside `AppShell`. Tap row → `services/$id`. Floating "+ Add" → `services/new`.
- `apps/dashboard/src/pages/services/new.tsx` — pushed route. Fields: name, duration, price (AZN with auto-conversion to qəpik on submit).
- `apps/dashboard/src/pages/services/$id.tsx` — edit + soft-delete (toggle `isActive`).
- `apps/dashboard/src/api/services.ts` — thin client over the endpoints.

Settings tab gets a "Services" row that pushes to `/services`.

## Acceptance

- Create a service from the dashboard → row appears in list AND in `prisma:studio`.
- Edit price/duration → updates persist.
- Soft-delete → row disappears from active filter but still exists in DB.
- Other tenant's services are not visible (verify with a second tenant in seed or Studio).
- `pnpm typecheck && pnpm lint` clean.
