# Adapting plans/mvp.md to the existing monorepo

## Context

`plans/mvp.md` describes the Bookla MVP — a phone-first reservation platform for AZ barbers/salons — but was written assuming a single Next.js app with UUID primary keys and a brand-new schema. The repo is actually a pnpm + Turbo monorepo already scaffolded with:

- `apps/api` — Hono on Node (also Lambda-ready), email/password JWT auth working
- `apps/dashboard` — React 19 + Vite + React Router 7, login/register pages live
- `apps/admin` — Vite stub
- `packages/db` — Prisma 7 client factory with `PrismaPg` driver, Secrets Manager support
- `packages/dto` — shared Zod schemas (`auth.ts`, `utils.ts`)
- `packages/utils` — AWS Secrets Manager helpers
- `prisma/schema/` — split schema (`tenants.prisma`, `enums.prisma`) with `Tenant`, `TenantUser`, integer autoincrement PKs

The goal of this document is to remap the MVP plan onto this scaffold so we can execute it without re-architecting what's already working. Decisions confirmed with the user:

1. **Auth:** replace email/password with phone + 6-digit OTP (existing auth controller, DTOs, frontend forms get rewritten).
2. **Business model:** extend `Tenant` to be the "Business" — no separate `Business` model.
3. **Primary keys:** keep `Int` autoincrement everywhere; use slugs for public URLs and a separate UUID column only on `Booking` (for client-facing confirmation links).
4. **Storefront:** new `apps/storefront` as a **server-rendered** React Router 7 app (RR7 framework mode), not a Vite SPA.
5. **Dashboard is mobile-app-first.** Tenants run their business from their phone, not a laptop. The dashboard is an installable PWA: every screen designed at 375px portrait first, bottom-tab navigation, full-screen sheets instead of modals, large touch targets, no hover-dependent UI. Desktop is scale-up, not the primary target.
6. **Auth tokens travel via cookie OR Authorization header.** Web/PWA uses the cookie pattern that already exists; a future native client (RN/Expo) drops in cleanly via Bearer. The auth middleware accepts either; `/auth/verify-otp` returns the JWT in the response body in addition to setting the cookie.

`AGENT_GUIDE.md` already anticipates `apps/cron`, `apps/storefront`, and `packages/messaging` — we're filling those in, not inventing new structure.

---

## Architecture deltas vs. mvp.md

| mvp.md says | We will do |
|---|---|
| Next.js App Router single app | `apps/api` (Hono) + `apps/dashboard` (Vite SPA, installable PWA, mobile-app-first) + `apps/storefront` (RR7 SSR) |
| UUID PKs everywhere | `Int` PKs; `Booking.publicId` is a UUID for confirmation links |
| `User` (professional) | `TenantUser` (extend with `phone`, drop `passwordHash`, `email`) |
| `Business` | `Tenant` (extend with `description`, `address`, `phone`, `avatarUrl`, `plan`, `timezone`) |
| NextAuth phone+OTP | Hono-native OTP endpoints + JWT cookie (keeps existing `authMiddleware`/cookie pattern) |
| Prisma in root | Already in `prisma/schema/` directory layout; add one `.prisma` file per new domain |
| Single seed script | Extend existing `prisma/seed.ts` with services, staff, working hours, sample bookings |
| `lib/slots.ts` in the app | `packages/slots` — pure functions, no DB. Reused by `apps/api` and `apps/storefront` loaders |
| SMS service in `lib/sms.ts` | `packages/messaging` — `SmsProvider` interface + `ConsoleSmsProvider`; future Twilio/local AZ provider plug in here |
| Reminder cron in-app | `apps/cron` — scheduled Lambda invoked hourly that scans for due reminders |

Everything else in mvp.md (flows, copy, business rules, mobile-first design direction, plan gates) stands.

---

## Database schema (adapted)

All models go under `prisma/schema/`. One file per domain. Run `pnpm prisma:migrate` after edits.

### `prisma/schema/enums.prisma` (extend)

Add:
```prisma
enum BusinessPlan { personal business }
enum BookingStatus { confirmed cancelled completed no_show }
enum BookingSource { online manual }
enum NotificationType { confirmation reminder_24h reminder_1h cancellation }
enum NotificationStatus { pending sent failed }
```

### `prisma/schema/tenants.prisma` (extend `Tenant`, rework `TenantUser`)

`Tenant` (= Business) — add:
```
description     String?
address         String?
phone           String?     // public contact, NOT the owner's login phone
avatarUrl       String?
plan            BusinessPlan @default(personal)
timezone        String       @default("Asia/Baku")
```
Existing `name`, `slug` (unique), `status`, timestamps stay.

`TenantUser` — replace email/password with phone:
```
- email        String        →  phone        String  @unique  (E.164)
- passwordHash String        →  (removed)
+ avatarUrl    String?
```
Drop the `@@unique([tenantId, email])` and `@@index([email])`; add `@@index([phone])`. Per MVP plan, one professional belongs to one business, so phone is globally unique.

### `prisma/schema/staff.prisma` (new)

```
Staff {
  id          Int      @id @default(autoincrement())
  tenantId    Int
  tenant      Tenant   @relation(...)
  userId      Int?     // nullable — staff may not have a login (added by owner)
  user        TenantUser? @relation(...)
  name        String
  phone       String?
  avatarUrl   String?
  isActive    Boolean  @default(true)
  sortOrder   Int      @default(0)
  createdAt / updatedAt
  @@index([tenantId, isActive])
}
```

### `prisma/schema/services.prisma` (new)

```
Service {
  id              Int
  tenantId        Int
  name            String
  durationMinutes Int
  priceAmount     Int          // qəpik (1 AZN = 100)
  currency        String       @default("AZN")
  isActive        Boolean      @default(true)
  sortOrder       Int          @default(0)
  createdAt / updatedAt
  @@index([tenantId, isActive])
}
```

### `prisma/schema/schedule.prisma` (new)

```
WorkingHours {
  id              Int
  staffId         Int
  dayOfWeek       Int          // 0=Mon ... 6=Sun
  startTime       String       // "09:00"
  endTime         String
  breakStartTime  String?
  breakEndTime    String?
  @@unique([staffId, dayOfWeek])
}

DayOff {
  id      Int
  staffId Int
  date    DateTime  @db.Date
  reason  String?
  @@unique([staffId, date])
}
```

### `prisma/schema/bookings.prisma` (new)

```
Booking {
  id          Int           @id @default(autoincrement())
  publicId    String        @unique @default(uuid())  // used in confirmation URLs
  tenantId    Int
  staffId     Int
  serviceId   Int
  clientId    Int
  date        DateTime      @db.Date
  startTime   String        // "14:30"
  endTime     String        // derived from start + service.durationMinutes
  status      BookingStatus @default(confirmed)
  source      BookingSource
  notes       String?
  createdAt / updatedAt

  @@index([tenantId, date])
  @@index([staffId, date, status])  // for slot conflict lookups
}

Client {
  id        Int
  tenantId  Int
  name      String
  phone     String
  notes     String?
  createdAt / updatedAt
  @@unique([tenantId, phone])
  @@index([tenantId])
}
```

### `prisma/schema/notifications.prisma` (new)

```
Notification {
  id         Int
  bookingId  Int
  type       NotificationType
  channel    String              @default("sms")  // enum kept loose for future
  recipient  String
  status     NotificationStatus  @default(pending)
  sentAt     DateTime?
  createdAt  DateTime
  @@unique([bookingId, type])    // hard guard against duplicate sends
  @@index([status, createdAt])
}
```

### `prisma/schema/otp.prisma` (new — auth replacement)

```
OtpChallenge {
  id          Int      @id @default(autoincrement())
  phone       String
  codeHash    String           // bcrypt of the 6-digit code; never store raw
  expiresAt   DateTime
  consumedAt  DateTime?
  attempts    Int      @default(0)
  createdAt   DateTime @default(now())
  @@index([phone, createdAt])
}
```

5-minute TTL, max 5 attempts per challenge, max 3 active challenges per phone per hour (rate-limit at service layer).

---

## Auth rework (replacing email/password)

Files to **rewrite**, not extend:
- `packages/dto/auth.ts` — replace `registerDto`/`loginDto` with `sendOtpDto`, `verifyOtpDto`, `onboardingDto`
- `apps/api/routes/auth/auth.service.ts` — replace `registerTenant`/`login` with `sendOtp`, `verifyOtp`, `completeOnboarding`
- `apps/api/routes/auth/auth.controller.ts` — new routes: `POST /auth/send-otp`, `POST /auth/verify-otp`, `POST /auth/onboarding`, `POST /auth/logout` (keep), `GET /auth/me` (keep, return shape changes)
- `apps/dashboard/src/pages/login.tsx` — phone input → OTP input (two-step UI)
- `apps/dashboard/src/pages/register.tsx` — delete; replaced by `/onboarding`
- `apps/dashboard/src/api/auth.ts` — match new endpoints
- `apps/dashboard/src/store/auth.store.ts` — drop email, add phone

Files to **modify** (small changes, keep the core):
- `apps/api/middleware/auth.middleware.ts` — extend token extraction to read from **either** the `AUTH_COOKIE` cookie **or** the `Authorization: Bearer <jwt>` header. Verification logic, user lookup field (now `phone`), and `c.set('user', ...)` all stay the same.
- `apps/api/routes/auth/auth.controller.ts` — `verify-otp` keeps `setAuthCookie(c, token)` AND returns `{ token, user, tenant }` in the body so a native client can store the JWT directly.

Files to **keep**:
- `apps/api/utils/jwt.ts`, `apps/api/utils/errors.ts`
- `apps/api/utils/password.ts` — repurpose `hashPassword`/`verifyPassword` as `hashOtpCode`/`verifyOtpCode` (bcrypt is fine for short-lived codes)

Files to **delete after migration**:
- All references to `passwordHash`, `email` on `TenantUser`
- Email validator usage in `packages/dto/auth.ts`

**Dev bypass:** `verifyOtp` accepts `000000` when `NODE_ENV !== 'production'` (matches mvp.md §2). Real OTP send goes through `packages/messaging`.

---

## SMS abstraction — `packages/messaging`

New package. Single file is fine to start:

```ts
// packages/messaging/index.ts
export interface SmsProvider {
  sendSms(to: string, message: string): Promise<{ messageId?: string }>;
}
export class ConsoleSmsProvider implements SmsProvider { ... }
export const getSmsProvider = (): SmsProvider => /* env-switched */
```

Used by `apps/api` (booking confirmation/cancellation, OTP) and `apps/cron` (24h reminders). No provider integration until post-MVP.

---

## Time-slot engine — `packages/slots`

New package. **Pure functions, no DB, no I/O.** Take inputs, return slot lists.

```ts
// packages/slots/index.ts
export const SLOT_INTERVAL_MINUTES = 15;

export interface SlotInput {
  workingHours: { startTime: string; endTime: string; breakStartTime?: string; breakEndTime?: string } | null;
  isDayOff: boolean;
  existingBookings: { startTime: string; endTime: string }[];   // CONFIRMED only
  serviceDurationMinutes: number;
  nowInBusinessTz: { date: string; time: string } | null;        // if same-day, filter past slots
}

export const getAvailableSlots = (input: SlotInput): string[] => { ... };
export const slotsOverlap = (aStart: string, aEnd: string, bStart: string, bEnd: string): boolean => { ... };
export const addMinutes = (hhmm: string, minutes: number): string => { ... };
```

The DB-fetching wrapper (loading working hours, day-offs, bookings, applying business timezone) lives in `apps/api/routes/bookings/bookings.service.ts` and is called by both the public slots endpoint and the manual-booking flow.

**Heavy testing here.** This is the only piece the plan calls out as needing thorough tests, and rightly so. Add `packages/slots/__tests__/slots.test.ts` with cases for: empty day, break overlap, end-of-day overflow, multiple existing bookings, today-with-past-times-filtered, timezone boundary.

---

## API routes (Hono, mapped to `apps/api/routes/<feature>/`)

All protected routes use existing `authMiddleware` and scope queries by `c.get('user').tenantId`.

```
apps/api/routes/
├── auth/                    (rewritten — see above)
├── public/                  (new — no auth)
│   ├── public.controller.ts
│   │   GET  /public/business/:slug          → tenant + active services + active staff (booking page payload)
│   │   GET  /public/business/:slug/slots    → query: staffId, serviceId, date → string[]
│   │   POST /public/bookings                → create booking (atomic conflict check inside tx)
│   │   GET  /public/bookings/:publicId      → confirmation details
│   └── public.service.ts
├── bookings/                (new — protected)
│   GET    /bookings           → range query for calendar
│   POST   /bookings           → manual booking (same atomic check as public)
│   PATCH  /bookings/:id       → status/notes/reschedule
├── services/                 (new — protected, full CRUD; DELETE = soft-deactivate)
├── clients/                  (new — protected; list + detail with history; PATCH notes only)
├── staff/                    (new — protected; gated by plan for >1 active)
├── schedule/                 (new — protected)
│   GET    /schedule/:staffId/working-hours
│   PUT    /schedule/:staffId/working-hours    → replace full week
│   GET    /schedule/:staffId/days-off
│   POST   /schedule/days-off
│   DELETE /schedule/days-off/:id
├── settings/                 (new — protected; tenant profile read/write + slug uniqueness)
└── stats/                    (new — protected, plan='business' gate)
```

**Atomic booking pattern** (used by both public and manual creation paths):

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
  // upsert client by (tenantId, phone), then create booking
}, { isolationLevel: 'Serializable' });
```

Error code `SLOT_UNAVAILABLE` matches mvp.md §8.

---

## DTOs — `packages/dto/`

One file per domain, all re-exported from `packages/dto/index.ts`. Files to add: `tenants.ts`, `services.ts`, `staff.ts`, `schedule.ts`, `bookings.ts`, `clients.ts`, `public.ts`, `stats.ts`. `auth.ts` gets rewritten in place.

Reuse existing helpers from `packages/dto/utils.ts` (`paginationDto`, `idValidator`, `emptyStringToUndefined`). Add a `phoneValidator` (E.164 normalizer for `+994XXXXXXXXX`) and `slugValidator` (lowercase a-z0-9 + dashes, 3–50 chars) — both used by multiple domains.

---

## Storefront — `apps/storefront` (RR7 framework mode, SSR)

Bootstrapped with `npx create-react-router@latest` (framework mode, SSR enabled, TypeScript). Package name `@bookla/storefront`.

**Why SSR is non-trivial:** the storefront has loaders that fetch from `apps/api` over HTTP. The internal API URL must differ from the public one (server-side uses `INTERNAL_API_URL` or localhost in dev; client-side fetches go through the public origin via CORS or proxy). Build the API client so loaders pass the request's `cookie`/origin through correctly.

**Route layout:**
```
apps/storefront/app/
├── routes/
│   ├── _index.tsx                     # 404 fallback or simple landing
│   ├── b.$slug.tsx                    # public booking page (the whole flow lives here)
│   └── b.$slug.confirmation.$publicId.tsx
├── components/                        # booking-flow components
├── lib/api.ts                         # SSR-aware fetch wrapper
└── root.tsx
```

The booking flow is a single route with sub-state (`?step=service|staff|date|slot|form`) so SSR hydration is straightforward. Slot fetches after initial load are client-side calls to `/public/business/:slug/slots`.

**Deploy story:** RR7 framework mode runs as a Node server. Following AGENT_GUIDE's one-Lambda-per-app convention, `apps/storefront` becomes a Lambda fronted by CloudFront. CDK changes are out of scope here.

**Critical:** Cannot reuse `apps/dashboard`'s Axios client directly — it assumes `withCredentials` and a browser. Build a thin `lib/api.ts` in storefront that works in both SSR loaders and client navigation.

---

## Dashboard — `apps/dashboard` (mobile-app-first PWA)

The dashboard is treated as a phone app from day one. Tenants will mostly run their business from a phone between clients. Desktop is responsive scale-up, not the design target.

**Design rules (non-negotiable):**
- Design every screen at 375px × 812px portrait first (iPhone reference). Tablet/desktop are best-effort upscaling.
- Bottom tab bar is the primary navigation: **Calendar · Bookings · Clients · Settings**. (Stats/Billing live under Settings or as a "More" sheet on Business plan.)
- Routes are full-screen, not modals. Editing a booking, adding a service, picking a date — each is a pushed route with a back button, the way a native app would.
- Touch targets ≥ 44×44px. No hover-only affordances. No tiny icon-only buttons without labels.
- Sticky FAB on the Calendar tab for "+ Add booking".
- Skeleton loaders, not centered spinners. Empty states are illustrated and actionable.
- Safe-area insets respected (`env(safe-area-inset-*)`) so the bottom tab bar sits above the iOS home indicator.
- Pull-to-refresh on list screens (Calendar, Clients) — implement with a small custom hook, not a heavy library.
- Use the platform share sheet (`navigator.share`) for the booking link.

**PWA setup (must ship with MVP):**
- `vite-plugin-pwa` configured in `apps/dashboard/vite.config.ts`.
- `public/manifest.webmanifest`: `name`, `short_name="Bookla"`, `display="standalone"`, `theme_color` and `background_color` matching the cream/gold palette, `start_url="/"`, `scope="/"`.
- Maskable PWA icons at 192/512px plus Apple touch icons. Generate from a single source SVG.
- Service worker with Workbox: precache the app shell, runtime-cache `GET /api/*` responses (network-first, short TTL) so the dashboard doesn't go fully blank on a flaky connection. Skip caching for mutations.
- App-shortcuts in the manifest: "Add Booking", "Today's Schedule".
- An "Install Bookla" prompt component that listens for `beforeinstallprompt` and shows a one-time banner.
- `apple-mobile-web-app-capable=yes` and themed status-bar meta tags in `index.html` so it looks right after "Add to Home Screen" on iOS.

**Layout primitives — add under `apps/dashboard/src/components/ui/`:**
- `AppShell` — top header (page title + optional right-side action), bottom tab bar, main content area with safe-area padding.
- `BottomTabBar` — fixed tabs with icons + labels, active state.
- `Sheet` — slide-up sheet for short forms (service edit, booking detail) where a full route push would be overkill.
- `Button`, `Input`, `TextArea`, `Select`, `DatePicker`, `TimeSlotGrid`, `EmptyState`, `Skeleton`.
- Keep this set deliberately small — no Radix/MUI/Chakra for MVP, just Tailwind primitives.

**Pages under `apps/dashboard/src/pages/`:**
- `login.tsx` (rewritten — phone+OTP two-step, full-screen)
- `onboarding.tsx` (new — multi-step: business name → slug → first service → working hours)
- `(tabs)/calendar.tsx` — day view default, swipe between days, week view toggle, FAB to add booking. Bottom tab active: Calendar.
- `(tabs)/bookings.tsx` — flat list view, filter by status. (Alternative entry point to the same data the calendar shows.)
- `(tabs)/clients.tsx` — list + search.
- `(tabs)/settings.tsx` — top-level menu: Business profile, Schedule, Services, Staff (gated), Stats (gated), Billing, Sign out.
- `bookings/$id.tsx` — full-screen booking detail (reschedule, cancel, mark complete, mark no-show).
- `bookings/new.tsx` — manual-booking flow as a pushed route.
- `clients/$id.tsx` — client detail with booking history.
- `services/index.tsx`, `services/new.tsx`, `services/$id.tsx`.
- `schedule/index.tsx` — weekly grid for working hours.
- `schedule/days-off.tsx` — calendar for tapping future dates off.
- `settings/profile.tsx`, `settings/staff.tsx` (gated), `settings/share.tsx`, `settings/stats.tsx`, `settings/billing.tsx`.

Router updates in `apps/dashboard/src/router.tsx`. The `(tabs)` group renders inside `AppShell` with the bottom tab bar; pushed routes (`bookings/$id`, `services/new`, etc.) render inside a back-button header instead. `ProtectedRoute` wraps everything except `/login`.

**Auth client (`apps/dashboard/src/api/base.ts`):** keep the Axios + `withCredentials: true` cookie flow as the default (it works in PWAs). Additionally, after `verify-otp` succeeds, stash the returned JWT in memory in the Zustand store so a Bearer header can be sent as a fallback. This costs nothing today and means a future RN client uses the exact same `api/*` module.

Tailwind is already wired via `index.css`. Add a tiny theme extension (cream/gold palette, safe-area utilities) in `tailwind.config.ts`.

---

## Cron — `apps/cron` (new)

Minimal Node entry that runs on a CloudWatch schedule (hourly). One handler today:

```
apps/cron/
├── index.ts            # handler dispatch
├── reminders.ts        # find confirmed bookings 23–25h out, send via packages/messaging, upsert Notification
└── package.json
```

Idempotency: rely on `Notification @@unique([bookingId, type])` to prevent duplicate sends.

---

## Critical files to modify

**Modify:**
- `prisma/schema/enums.prisma` — add enums
- `prisma/schema/tenants.prisma` — extend `Tenant`, rework `TenantUser` (drop email/password, add phone)
- `prisma/seed.ts` — replace acme with "Tural's Barbershop" (3 services, Mon–Sat hours, 5 sample bookings)
- `apps/api/index.ts` — mount new controllers
- `apps/api/env.ts` — add `INTERNAL_API_URL` (for storefront), drop email-specific vars if any
- `apps/api/routes/auth/auth.{controller,service}.ts` — full rewrite (OTP)
- `apps/api/middleware/auth.middleware.ts` — update user shape (phone, no email)
- `packages/dto/auth.ts` — full rewrite
- `packages/dto/index.ts` — export new domains
- `packages/dto/utils.ts` — add `phoneValidator`, `slugValidator`
- `packages/db/index.ts` — re-export new Prisma types (Service, Staff, Booking, etc.)
- `apps/dashboard/src/router.tsx`, `pages/login.tsx`, `api/auth.ts`, `store/auth.store.ts` — auth rewrite
- `apps/dashboard/vite.config.ts` — add `vite-plugin-pwa` config
- `apps/dashboard/index.html` — PWA meta tags (theme-color, apple-mobile-web-app-capable, viewport-fit=cover for safe areas)
- `apps/dashboard/tailwind.config.ts` — cream/gold theme tokens, safe-area utilities
- `tsconfig.json` — add path aliases for new packages (`@slots/*`, `@messaging/*`)
- `pnpm-workspace.yaml` — no change (already covers `apps/*` and `packages/*`)
- `.env.example` — drop `JWT_SECRET` related comment, add `INTERNAL_API_URL`, `SMS_PROVIDER=console`

**Create:**
- `prisma/schema/staff.prisma`, `services.prisma`, `schedule.prisma`, `bookings.prisma`, `notifications.prisma`, `otp.prisma`
- `packages/slots/` (package.json, index.ts, `__tests__/slots.test.ts`)
- `packages/messaging/` (package.json, index.ts)
- `packages/dto/tenants.ts`, `services.ts`, `staff.ts`, `schedule.ts`, `bookings.ts`, `clients.ts`, `public.ts`, `stats.ts`
- `apps/api/routes/public/`, `bookings/`, `services/`, `clients/`, `staff/`, `schedule/`, `settings/`, `stats/` — each with `.controller.ts` + `.service.ts`
- `apps/storefront/` — full RR7 framework-mode app
- `apps/cron/` — handler + reminder job
- `apps/dashboard/public/manifest.webmanifest`, icon assets (192, 512, maskable, apple-touch)
- `apps/dashboard/src/components/ui/` — AppShell, BottomTabBar, Sheet, Button, Input, TimeSlotGrid, EmptyState, Skeleton
- New dashboard pages listed above

**Delete after migration:**
- `apps/dashboard/src/pages/register.tsx` (replaced by `/onboarding`)
- Email/password code paths in auth (after the schema migration applies)

---

## Reused, existing utilities to keep

- `apps/api/utils/jwt.ts` — JWT cookie auth pattern stays; only the JWT payload's identity field changes (`userId` still works)
- `apps/api/utils/errors.ts` — `AppError` is exactly what mvp.md §8 prescribes; reuse for `SLOT_UNAVAILABLE`, `PLAN_LIMIT_REACHED`, etc.
- `apps/api/middleware/auth.middleware.ts` — keep as-is structurally
- `packages/db/index.ts` — `getPrismaClient()` works for new models without changes
- `packages/dto/utils.ts` — `paginationDto`, `idValidator`, `emptyStringToUndefined` get reused throughout new DTOs
- `apps/api/utils/password.ts` — bcrypt helpers repurposed for OTP code hashing
- `apps/dashboard/src/api/base.ts` — Axios + `ClientError` pattern stays

---

## Build order (adapted from mvp.md §"Development Order")

Sequence chosen so each step is independently deployable and the slot engine (the heart of the app) is built early with tests.

1. **Schema migration** — extend enums, `Tenant`, `TenantUser`; add `Staff`, `Service`, `WorkingHours`, `DayOff`, `Booking`, `Client`, `Notification`, `OtpChallenge`. One migration. Update `prisma/seed.ts`. Verify with `pnpm prisma:migrate` + `pnpm prisma:seed` + `pnpm prisma:studio`.
2. **Phone+OTP auth (api + dto)** — rewrite auth controller/service/DTOs; build OTP send/verify with `ConsoleSmsProvider`. Update `auth.middleware` to accept Bearer in addition to cookie; `verify-otp` returns `token` in body.
3. **Dashboard mobile shell** — install `vite-plugin-pwa`, add manifest + icons + meta tags, build `AppShell` + `BottomTabBar` + safe-area Tailwind utilities. This is the chassis every later screen plugs into; build it BEFORE the feature pages so we never write a non-mobile-first screen and have to refactor it.
4. **Dashboard auth UI** — login.tsx (two-step), onboarding.tsx, store update. Stash JWT in Zustand for Bearer fallback.
5. **Services CRUD** — simplest domain, builds confidence with controller/service/DTO pattern; first feature built on the mobile shell.
6. **Schedule (working hours + days off)** — needed before slots can be calculated.
7. **`packages/slots`** — pure logic + tests. Plug DB wrapper in `apps/api`.
8. **`apps/storefront` scaffold + public booking flow** — including atomic booking creation.
9. **Dashboard calendar view** — day view first, then week. Swipeable between days. FAB for add-booking.
10. **Manual booking** — full-screen pushed route, reuses slot engine wrapper.
11. **Client list** — auto-populated from bookings.
12. **Staff management** — Business-plan gate.
13. **Business settings** — profile, slug edit, share-link UX (uses `navigator.share`).
14. **`packages/messaging` integrations** — confirmation/cancellation SMS in api; `apps/cron` for 24h reminders.
15. **Stats dashboard** — Business-plan gate.
16. **Billing page** — informational, no payments.
17. **PWA polish** — install prompt component, app-shortcut manifest entries, Lighthouse PWA audit ≥ 90, test "Add to Home Screen" on an actual iOS device.
18. **Polish** — loading/empty/error states, responsive sweep up to desktop widths.

---

## Verification

End-to-end check after each milestone, but the full integration test once everything is wired:

1. `pnpm install && pnpm prisma:generate && pnpm prisma:migrate && pnpm prisma:seed`
2. `pnpm dev:api` (4200), `pnpm dev:dashboard` (5173), `pnpm dev:storefront` (3000, port TBD)
3. **Auth:** open `localhost:5173/login`, enter the seeded phone, use bypass code `000000`, land on dashboard.
4. **Onboarding (if fresh seed):** create business → verify `Tenant` row in Studio.
5. **Services:** add Haircut (30m, 15 AZN). Verify it appears in dashboard list AND on `localhost:3000/b/<slug>`.
6. **Slots:** open `/b/<slug>`, pick Haircut, pick today, confirm slots are correct given seeded working hours and skip past-now slots.
7. **Booking creation:** complete a booking → confirmation page renders with `publicId` URL → `Notification` row exists with `type=confirmation, status=sent` → confirmation SMS logged to api console.
8. **Race-safety:** fire two parallel `POST /public/bookings` for the same slot via `curl`. Exactly one succeeds; the other returns `SLOT_UNAVAILABLE`.
9. **Dashboard calendar:** the just-created booking shows on the day view; tapping it shows client name/phone.
10. **Manual booking:** add a phone-call booking from the dashboard with the same slot — should be rejected for overlap.
11. **Plan gate:** try to add a second active staff member on a `personal` plan tenant → `PLAN_LIMIT_REACHED`. Flip `Tenant.plan` to `business` in Studio → succeeds.
12. **Reminder cron (manual invoke):** create a booking ~24h out, run `pnpm tsx apps/cron/index.ts` once, verify a `reminder_24h` Notification row gets written and re-running it does NOT create a duplicate (uniqueness constraint).
13. **Mobile/PWA checks:**
    - Open `localhost:5173` on an actual phone (or Chrome devtools iPhone preset). Every flow must be reachable and usable in portrait at 375px without horizontal scroll.
    - Bottom tab bar visible above the home indicator. FAB on the calendar tab works.
    - Lighthouse "Installable PWA" audit ≥ 90 in Chrome devtools.
    - On iOS Safari, "Add to Home Screen" produces an icon that opens the dashboard standalone with the right theme color and no browser chrome.
    - Toggle airplane mode after a first load — the app shell still renders and shows a sane offline state instead of a blank page.
14. **Auth transport:** issue a `curl POST /auth/verify-otp` with `000000`, get a `token` back in the body, then `curl GET /auth/me -H "Authorization: Bearer <token>"` succeeds without sending a cookie. The cookie flow still works from the dashboard.
15. `pnpm typecheck && pnpm lint && pnpm build` — clean across all workspaces.
16. `pnpm vitest packages/slots` — all slot-engine tests green.
