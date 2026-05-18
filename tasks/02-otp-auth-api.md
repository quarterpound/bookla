# 02 — Phone+OTP auth (API)

Replace email/password with phone + 6-digit OTP. Keeps the existing JWT cookie pattern; adds Bearer-header support for future native clients.

Depends on: **01**.

## Endpoints

- `POST /auth/send-otp` — body `{ phone }`. Creates an `OtpChallenge` (5-min TTL, bcrypt-hashed code). Rate-limit: max 3 active challenges per phone per hour. Sends code via `packages/messaging`.
- `POST /auth/verify-otp` — body `{ phone, code }`. Returns `{ token, user, tenant }` AND sets `AUTH_COOKIE`. Increments `attempts`; rejects after 5. Marks `consumedAt` on success. **Dev bypass:** code `000000` is accepted when `NODE_ENV !== 'production'`.
- `POST /auth/onboarding` — protected. Body matches `onboardingDto`: `{ businessName, slug, firstService: { name, durationMinutes, priceAmount }, workingHours }`. Creates the `Tenant`, sets `slug`, creates `Staff` row for the owner, first `Service`, default `WorkingHours`.
- `POST /auth/logout` — unchanged.
- `GET /auth/me` — return `{ user: { id, phone, name, avatarUrl }, tenant }`. Shape changes (no email).

## Files

**Rewrite:**
- `packages/dto/auth.ts` — replace `registerDto`/`loginDto` with `sendOtpDto`, `verifyOtpDto`, `onboardingDto`.
- `apps/api/routes/auth/auth.service.ts` — `sendOtp`, `verifyOtp`, `completeOnboarding`.
- `apps/api/routes/auth/auth.controller.ts` — new route table.
- `apps/api/utils/password.ts` — rename/repurpose `hashPassword`/`verifyPassword` to `hashOtpCode`/`verifyOtpCode` (bcrypt is fine for short-lived codes).

**Modify:**
- `apps/api/middleware/auth.middleware.ts` — extract token from **either** `AUTH_COOKIE` cookie **or** `Authorization: Bearer <jwt>` header. User lookup field changes to `phone`. `c.set('user', ...)` shape unchanged structurally.
- `packages/dto/utils.ts` — add `phoneValidator` (E.164 normalizer for `+994XXXXXXXXX`) and `slugValidator` (lowercase a-z0-9 + dashes, 3–50 chars).
- `packages/dto/index.ts` — export new DTOs.
- `apps/api/index.ts` — no route changes (auth controller already mounted), but verify.
- `.env.example` — add `SMS_PROVIDER=console`.

**Create:**
- `packages/messaging/package.json`, `packages/messaging/index.ts` — `SmsProvider` interface, `ConsoleSmsProvider` (logs to console), `getSmsProvider()` env-switched.

## Acceptance

- `curl POST /auth/send-otp { phone: "+994501234567" }` → 200, console logs the code.
- `curl POST /auth/verify-otp { phone, code: "000000" }` (dev) → 200 with `{ token, user, tenant }`, sets cookie.
- `curl GET /auth/me -H "Authorization: Bearer <token>"` → 200 without a cookie.
- `curl GET /auth/me` with cookie only → 200.
- Wrong code 5 times invalidates the challenge.
- `pnpm typecheck` clean.

## Notes

- Keep `apps/api/utils/jwt.ts` unchanged. The JWT payload's `userId` field is still meaningful — `TenantUser.id` is still an int.
- The `Notification @@unique([bookingId, type])` constraint does **not** apply here; OTPs are not booking notifications.
