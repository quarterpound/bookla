# 04 — Dashboard auth UI

Rewrite login as a two-step phone+OTP flow. Add the onboarding wizard. Drop the old register page.

Depends on: **02**, **03**.

## Files

**Rewrite:**
- `apps/dashboard/src/pages/login.tsx` — two-step, full-screen. Step 1: phone input → `POST /auth/send-otp`. Step 2: 6-digit code input → `POST /auth/verify-otp`. On success, stash JWT in Zustand AND rely on the cookie that's already set.
- `apps/dashboard/src/api/auth.ts` — match the new endpoints (`sendOtp`, `verifyOtp`, `onboarding`, `me`, `logout`).
- `apps/dashboard/src/store/auth.store.ts` — drop email field, add `phone` and `token` (in-memory only; cookie remains the primary transport).

**Create:**
- `apps/dashboard/src/pages/onboarding.tsx` — multi-step pushed-route flow: business name → slug (with `slugValidator` + live uniqueness check via `GET /settings/slug-available?slug=` if not yet implemented, otherwise validate client-side) → first service → working hours. Submit → `POST /auth/onboarding`.

**Delete:**
- `apps/dashboard/src/pages/register.tsx` — replaced by onboarding.

**Modify:**
- `apps/dashboard/src/router.tsx` — `/login`, `/onboarding` are full-screen (no `AppShell`); everything else stays behind `ProtectedRoute` inside `AppShell`.
- `apps/dashboard/src/api/base.ts` — keep `withCredentials: true`; additionally read the in-memory token from the auth store and send `Authorization: Bearer <token>` so a future RN client uses the same module.

## Acceptance

- Open `/login`, enter seeded phone, enter `000000`, land on the dashboard (or onboarding if the tenant has no business name yet).
- Reloading the page keeps the session (cookie-backed); navigating across routes works.
- `/onboarding` produces a fully usable tenant: slug claimed, one service, one staff (owner), default working hours.
- Sign out clears the cookie + in-memory token and bounces to `/login`.

## Notes

- The auth store's in-memory token is intentionally not persisted. It's only there so requests can include a Bearer header alongside the cookie — both transports are valid per the plan.
- The onboarding screen is mobile-first. No multi-column layouts. One question per screen.
