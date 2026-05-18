# 08 — Storefront scaffold + public booking flow

New SSR app and the public-facing booking endpoints. The atomic conflict check ships here.

Depends on: **01**, **07**.

## Scaffold — `apps/storefront/`

- Bootstrap with `npx create-react-router@latest` (framework mode, SSR, TypeScript). Package name `@bookla/storefront`.
- `apps/storefront/app/lib/api.ts` — SSR-aware fetch wrapper. Server-side uses `INTERNAL_API_URL`; client-side uses the public origin. Pass through `cookie` / origin headers from the loader's request when needed.
- Add `INTERNAL_API_URL` to `apps/api/env.ts` reference list and to `.env.example`.

**Routes:**
```
apps/storefront/app/routes/
├── _index.tsx                          # simple landing / 404
├── b.$slug.tsx                         # full booking flow (single route, sub-state via ?step=)
└── b.$slug.confirmation.$publicId.tsx  # confirmation page
```

Booking flow sub-states: `service → staff → date → slot → form`. SSR the initial state; slot fetches after first paint are client-side calls to `/public/business/:slug/slots`.

**Cannot** reuse `apps/dashboard`'s Axios client — it assumes `withCredentials` and a browser.

## API — `apps/api/routes/public/` (no auth)

- `GET  /public/business/:slug` → `{ tenant, services: Service[], staff: Staff[] }` (active rows only).
- `GET  /public/business/:slug/slots?staffId&serviceId&date` → `string[]`. Uses the wrapper from task **07**.
- `POST /public/bookings` → atomic create (see below). Returns `{ publicId }`.
- `GET  /public/bookings/:publicId` → `{ booking, tenant, service, staff }` for the confirmation page.

## Atomic booking pattern

Used by both this task's public endpoint and task **10**'s manual booking endpoint:

```ts
await db.$transaction(async (tx) => {
  const conflicts = await tx.booking.count({
    where: {
      staffId, date,
      status: 'confirmed',
      NOT: { OR: [ { endTime: { lte: startTime } }, { startTime: { gte: endTime } } ] },
    },
  });
  if (conflicts > 0) throw new AppError('Slot unavailable', 'SLOT_UNAVAILABLE', 409);
  // upsert Client by (tenantId, phone), then create Booking
}, { isolationLevel: 'Serializable' });
```

Error code `SLOT_UNAVAILABLE` matches plan §8.

## DTO — `packages/dto/public.ts`

- `publicBookingCreateDto` — `{ slug, staffId, serviceId, date, startTime, client: { name, phone }, notes? }`. Use `phoneValidator`.

## Acceptance

- `pnpm dev:storefront` boots; `localhost:<port>/b/<seed-slug>` renders the booking page server-side (view-source shows real content, not an empty shell).
- Slot list matches what `packages/slots` would compute given the seeded working hours + bookings.
- Submit a booking → confirmation page reachable at `/b/<slug>/confirmation/<publicId>` and the row exists in DB.
- Race test: fire two parallel `curl POST /public/bookings` for the same slot; exactly one returns 200, the other returns 409 `SLOT_UNAVAILABLE`.
- No JWT/cookie required for any `/public/*` route.

## Notes

- CDK/Lambda packaging for `apps/storefront` is **out of scope**. Local dev only for MVP.
- Confirmation SMS is **not** sent yet — that's task **14**. For now, just create the `Notification` row with `status='pending'`.
