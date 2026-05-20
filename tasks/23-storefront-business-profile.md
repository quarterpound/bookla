# 23 — Storefront business profile

Enrich the public booking page (`/b/<slug>`) with the information a prospective client actually needs to commit: description, public phone, address with a maps deep-link, working-hours summary, and a small photo gallery. Today the storefront only shows name + avatar + address (`apps/storefront/app/components/BusinessHeader.tsx`).

Depends on: **06** (schedule data), **08** (storefront flow), **13** (dashboard profile edit surface — this task adds the gallery management to it).

## Status today

- `Tenant` already has `description`, `address`, `phone`, `avatarUrl`, `timezone` (schema task 01). The first three are persisted but never rendered on the storefront.
- `WorkingInterval` rows exist per `(staff, dayOfWeek)`; nothing aggregates them into a tenant-level "hours" summary for the public page.
- No model for multi-photo galleries — `avatarUrl` is the only image field.

## Schema — `prisma/schema/tenants.prisma`

Add a new model:

```prisma
model TenantPhoto {
  id         Int      @id @default(autoincrement())
  tenantId   Int      @map("tenant_id")
  tenant     Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  url        String
  alt        String?
  sortOrder  Int      @default(0) @map("sort_order")

  createdAt  DateTime @default(now()) @map("created_at")

  @@index([tenantId, sortOrder])
  @@map("tenant_photos")
}
```

Back-ref `photos TenantPhoto[]` on `Tenant`. Migration: additive, no backfill needed.

`avatarUrl` stays as the logo / primary photo; the gallery is supplementary.

## API

- Extend `GET /public/business/:slug` payload (`apps/api/routes/public/public.service.ts`) to include:
  - `description`, `phone` (already in `PublicBusinessTenant` interface — just stop omitting them in any UI).
  - `photos: { url, alt }[]` (ordered by `sortOrder` then `id`).
  - `hoursSummary`: a 7-entry array, one per `dayOfWeek` (0=Mon..6=Sun), each `{ dayOfWeek, intervals: { startTime, endTime }[] }`. Empty intervals = closed that weekday. The summary is derived from the FIRST active staff member's `WorkingInterval` rows for Personal-plan tenants (one staff); for Business-plan multi-staff tenants, document that the summary represents the union of all active staff (so clients see "we're open Mon 09–18" if at least one staff works then). Add a brief code comment explaining the choice.
- New endpoints (authed, owner/manager only) under `apps/api/routes/settings/photos/`:
  - `GET    /settings/photos` → list
  - `POST   /settings/photos` → create (url, optional alt, optional sortOrder)
  - `PATCH  /settings/photos/:id` → update (alt, sortOrder)
  - `DELETE /settings/photos/:id` → remove
- DTO: extend `packages/dto/public.ts` with the new fields on `PublicBusinessResponseDto`. Add `packages/dto/tenant-photos.ts` for the authed CRUD.

## Storefront — `apps/storefront/app/routes/b.$slug.tsx`

Profile content lives on the **service step** (step 1), above the service list. Not a separate route — fewer taps, SSR-friendly, doesn't break the existing `?step=` flow.

- **Header**: existing `BusinessHeader` keeps avatar + name + address. Address becomes a tappable link that deep-links to maps (`https://maps.google.com/?q=<encoded address>`). If `phone` is set, add a small tap-to-call link (`tel:<phone>`).
- **Description**: short blurb shown under the header. Collapse to ~3 lines with "Show more" if long.
- **Photo gallery**: horizontal-scroll carousel of `TenantPhoto[]` thumbnails on phone (snap scrolling), grid on `sm+`. Skip the section entirely when `photos.length === 0`.
- **Hours summary**: compact 7-row list ("Mon — 09:00–13:00, 14:00–19:00" / "Tue — Closed"). Highlight the current weekday. Use the locale's day-of-week names.

Profile content collapses (or moves to a tiny "Info" link) once the user has selected a service — they don't need to see the description while picking a date. Easiest implementation: only render the profile content when `flow.step === 'service'`.

i18n keys to add (az/en/ru): `booking.profile.hoursTitle`, `booking.profile.hoursClosed`, `booking.profile.showMore`, `booking.profile.callAction`, `booking.profile.directionsAction`, `booking.profile.galleryAlt`.

## Dashboard

Extend Settings → Profile (task 13) with a "Photos" section: list of URLs with reorder (drag or up/down buttons) and remove. Add-by-URL only (no upload UI yet, matches task 13's avatar-as-URL approach). Defer S3 / CDN integration.

## Acceptance

- `/b/<slug>` renders description, phone (tap-to-call), address (tap-to-map), hours summary, and the photo gallery — all via SSR (view-source shows the content).
- Adding a photo from the dashboard appears on the public page on the next navigation; removing one disappears.
- Tap-to-call opens the dialer with the right number on mobile.
- Tap-to-map opens the platform's maps app on iOS/Android.
- Hours summary correctly reflects working intervals AND day-of-the-week closures; today's weekday is highlighted.
- Empty gallery: the section is omitted entirely (no empty placeholder).
- Empty description / phone / address: each row is gracefully hidden.

## Explicitly NOT in scope

- S3 / CDN photo uploads. Photos are added by URL for MVP, same as `avatarUrl`.
- A separate "About" route or modal — the profile lives on the service step inline.
- Map embed (Google Maps iframe / Apple MapKit). Deep-link to maps app only.
- Per-photo captions beyond `alt` text.
- Showing staff bios on the storefront (could be a future task).
- Per-staff working-hours breakdown on the storefront. The summary is tenant-level. Per-staff schedules are still used by the slot engine.
