# 01 — Schema migration & seed

Foundation for everything else. One migration; no app code changes yet.

## Scope

Extend the Prisma schema to cover the full MVP domain, rework `TenantUser` from email/password to phone, and replace the seed with a realistic AZ barbershop fixture.

## Files to modify

- `prisma/schema/enums.prisma` — add `BusinessPlan`, `BookingStatus`, `BookingSource`, `NotificationType`, `NotificationStatus`.
- `prisma/schema/tenants.prisma`:
  - **Tenant**: add `description`, `address`, `phone`, `avatarUrl`, `plan` (`@default(personal)`), `timezone` (`@default("Asia/Baku")`).
  - **TenantUser**: drop `email`, `passwordHash`, the `@@unique([tenantId, email])`, and the `@@index([email])`. Add `phone String @unique` (E.164), `avatarUrl String?`, `@@index([phone])`.
- `prisma/seed.ts` — replace `acme` fixture with "Tural's Barbershop": owner phone, 3 services, Mon–Sat working hours, 5 sample bookings across past/today/future.

## Files to create

- `prisma/schema/staff.prisma` — `Staff` (tenantId, optional userId, name, phone, avatarUrl, isActive, sortOrder).
- `prisma/schema/services.prisma` — `Service` (tenantId, name, durationMinutes, priceAmount in qəpik, currency `@default("AZN")`, isActive, sortOrder).
- `prisma/schema/schedule.prisma` — `WorkingHours` (staffId, dayOfWeek 0–6, startTime, endTime, optional break, `@@unique([staffId, dayOfWeek])`), `DayOff` (staffId, date `@db.Date`, reason, `@@unique([staffId, date])`).
- `prisma/schema/bookings.prisma`:
  - `Booking` (publicId UUID, tenantId, staffId, serviceId, clientId, date `@db.Date`, startTime, endTime, status, source, notes; indexes `[tenantId, date]` and `[staffId, date, status]`).
  - `Client` (tenantId, name, phone, notes, `@@unique([tenantId, phone])`).
- `prisma/schema/notifications.prisma` — `Notification` (bookingId, type, channel `@default("sms")`, recipient, status `@default(pending)`, sentAt, `@@unique([bookingId, type])`, `@@index([status, createdAt])`).
- `prisma/schema/otp.prisma` — `OtpChallenge` (phone, codeHash, expiresAt, consumedAt, attempts, `@@index([phone, createdAt])`).

See plan §"Database schema (adapted)" for exact field shapes.

## Acceptance

- `pnpm prisma:generate` succeeds.
- `pnpm prisma:migrate` produces a single new migration that applies cleanly to a fresh DB.
- `pnpm prisma:seed` populates the new tenant, 1 owner `TenantUser`, 1+ `Staff`, 3 `Service`, 6 `WorkingHours` rows, ≥1 `Client`, 5 `Booking` rows.
- `pnpm prisma:studio` shows every new table.
- Re-exports updated in `packages/db/index.ts` so `Service`, `Staff`, `Booking`, `Client`, `Notification`, `OtpChallenge`, `WorkingHours`, `DayOff` types are importable.

## Notes

- Keep all PKs as `Int @id @default(autoincrement())`. UUID lives **only** on `Booking.publicId`.
- App code still references the old email/password fields; expect TypeScript to break in `apps/api/routes/auth/*` after this lands. That's fine — task 02 rewrites those files. Land 01 and 02 in the same PR if breaking `main` is unacceptable.
