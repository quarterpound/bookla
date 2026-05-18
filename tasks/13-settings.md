# 13 — Business settings + share link

Tenant profile + the share-link surface that drives every public booking.

Depends on: **04**.

## API — `apps/api/routes/settings/`

- `GET /settings/profile` → `Tenant` fields the tenant can edit (name, description, address, phone, avatarUrl, slug, timezone).
- `PATCH /settings/profile` — update any of the above. `slug` change checks uniqueness and updates atomically.
- `GET /settings/slug-available?slug=` → `{ available: boolean }`.

DTO: `packages/dto/tenants.ts` with `tenantProfileUpdateDto`. Reuse `slugValidator`.

## Dashboard

- `apps/dashboard/src/pages/settings/profile.tsx` — business name, description, address, public phone, avatar upload (defer the actual S3/CDN bit; accept a URL field for MVP), timezone selector (default `Asia/Baku`).
- `apps/dashboard/src/pages/settings/share.tsx` — shows the public URL (`https://<host>/b/<slug>`), a copy button, a QR code (use a tiny lib like `qrcode` to generate inline SVG), and a "Share" button calling `navigator.share` when available.

## Acceptance

- Editing the profile persists and the public booking page (`/b/<slug>`) reflects updates.
- Slug rename: old URL 404s, new URL works. (Optional: 302 redirect — defer.)
- Share button opens the native share sheet on iOS/Android; falls back to copy-to-clipboard on desktop.
- QR scans correctly on a phone and lands on the booking page.

## Notes

- Avatar upload via signed URL is out of scope. A plain URL field is fine for MVP.
- Don't expose timezone changes after the first booking is created without a warning — bookings' `startTime` strings are timezone-naive, and changing the business tz mid-flight will break the slot math. Show a warning if `Booking` count > 0.
