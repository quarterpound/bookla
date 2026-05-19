# 19 — Social login (Google + Apple)

Add "Continue with Google" and "Continue with Apple" as alternative sign-in methods on the dashboard. Phone+OTP stays the default; social is additive — same `TenantUser`, same JWT, same onboarding flow.

This is **post-MVP**. Phone-only sign-in (tasks **02** + **04**) is enough to ship. Add this once the MVP is in real users' hands and we see which install path they actually prefer.

Depends on: **02** (auth API), **04** (auth UI). No schema rework beyond what's listed below.

## Why both providers

- **Apple** is mandatory if we ever ship an iOS-wrapped build to the App Store (review guideline 4.8): any app offering third-party social sign-in must also offer Sign in with Apple. We can avoid it for now (web PWA), but adding it early is cheaper than waiting until we want a native shell.
- **Google** is by far the most common social login in the AZ market for non-Apple users. Pairs well with the existing Google account most owners already use.
- Both are JWT-based — the API does identity-token verification against the provider's JWKS, no OAuth code-exchange detour, no extra server roundtrips.

## Database — `prisma/schema/`

**Modify `tenants.prisma` → `TenantUser`:**
- `phone String @unique` → `phone String? @unique` — phone becomes optional. A social-only account may never set a phone (SMS reminders just won't work for that owner until they add one; surfaced as a banner).
- Add `email String?` — Apple/Google both return a verified email; useful for support/account recovery. Not unique (tenants can share emails across personal/business accounts).
- Add `emailVerified Boolean @default(false)` — only set true when received via a verified-claim provider.

**New file `prisma/schema/oauth.prisma`:**
```
model OAuthIdentity {
  id        Int      @id @default(autoincrement())
  userId    Int      @map("user_id")
  user      TenantUser @relation(fields: [userId], references: [id], onDelete: Cascade)
  provider  OAuthProvider
  subject   String   // "sub" claim — provider-stable user id
  email     String?
  createdAt DateTime @default(now()) @map("created_at")

  @@unique([provider, subject])
  @@index([userId])
  @@map("oauth_identities")
}
```

**`enums.prisma`** — add:
```
enum OAuthProvider {
  google
  apple

  @@map("oauth_provider")
}
```

A user can have at most one identity per provider (the `@@unique`) but multiple providers across rows. Linking happens at sign-in time (see below).

## API — `apps/api/`

**Files:**
- `apps/api/utils/oauth/google.ts` — `verifyGoogleIdToken(idToken: string): Promise<{ sub, email, emailVerified, name? }>`. Use JWKS from `https://www.googleapis.com/oauth2/v3/certs`. Validate `aud` against `GOOGLE_CLIENT_IDS` (comma-separated; web + future iOS/Android each have their own client id).
- `apps/api/utils/oauth/apple.ts` — `verifyAppleIdToken(idToken: string): Promise<{ sub, email?, emailVerified, isPrivateEmailRelay }>`. JWKS from `https://appleid.apple.com/auth/keys`. Validate `aud` against `APPLE_SERVICE_ID`. Reject if `iss !== 'https://appleid.apple.com'`. Cache JWKS per process (24h TTL; refresh on signature failure).
- `apps/api/utils/oauth/jwks.ts` — shared JWKS fetcher + key cache. Implement via `jose` (already a hono/jwt transitive dep, or pin it explicitly).
- `apps/api/routes/auth/auth.service.ts` — add `signInWithGoogle({ idToken })` and `signInWithApple({ idToken, name? })`. Both reuse `findOrCreateUserByOAuth(provider, sub, { email, emailVerified, name? })`.
- `apps/api/routes/auth/auth.controller.ts` — `POST /auth/google` body `{ idToken }`; `POST /auth/apple` body `{ idToken, name? }` (Apple only returns the name on the *first* sign-in, the client must persist it).
- `apps/api/env.ts` — add `GOOGLE_CLIENT_IDS: string` (CSV), `APPLE_SERVICE_ID: string`, `APPLE_TEAM_ID: string` (only needed for client-secret if we later need the token endpoint, not for ID-token verify).

**Linking policy** — when a social sign-in arrives:
1. If `OAuthIdentity` exists for `(provider, sub)` → log in as that user.
2. Else if the token's email is verified AND a `TenantUser` exists with `phone IS NOT NULL AND email = <token email>` → **do not auto-link**. Return `400 OAUTH_EMAIL_CONFLICT`; the dashboard surfaces a "this email is already linked to a phone account — sign in with phone first, then link Google/Apple in Settings" message.
3. Else create a new `TenantUser` with `phone = null`, `email = <token email>`, plus an `OAuthIdentity` row. Tenant remains a placeholder until onboarding runs (same `pending-<ts>` slug trick from task 02).

The reverse (signed-in user explicitly linking a provider from Settings) is a separate flow — see below.

**Account linking from Settings:**
- `POST /auth/oauth/link` (auth required) body `{ provider, idToken, name? }`. Verifies the token, ensures no other user owns `(provider, sub)`, inserts an `OAuthIdentity`. Used by the dashboard's "Connect Google" / "Connect Apple" buttons in Settings.
- `DELETE /auth/oauth/:provider` (auth required) removes the identity. Reject the delete if it would leave the user with **no** way to sign in (no phone AND no remaining provider).

## DTOs — `packages/dto/auth.ts`

Add:
```
googleSignInDto = z.object({ idToken: z.string().min(1) })
appleSignInDto  = z.object({ idToken: z.string().min(1), name: z.string().max(80).optional() })
linkProviderDto = z.object({
  provider: z.enum(['google', 'apple']),
  idToken:  z.string().min(1),
  name:     z.string().max(80).optional(),
})
```

Response shape stays `AuthSession` (token, user, tenant) — same as `verifyOtp`. The dashboard auth store doesn't need a new type.

## Dashboard — `apps/dashboard/`

**Files to create:**
- `apps/dashboard/src/lib/oauth/google.ts` — wraps the Google Identity Services (GIS) script. Lazy-loaded; renders a button via `google.accounts.id.renderButton` or triggers `prompt()` for one-tap. Returns the `idToken` from the credential callback.
- `apps/dashboard/src/lib/oauth/apple.ts` — wraps `https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js`. `AppleID.auth.init({ clientId: VITE_APPLE_SERVICE_ID, redirectURI, scope: 'email name', usePopup: true })`. Returns the identity token + name from the popup completion event.
- `apps/dashboard/src/api/auth.ts` — add `googleSignIn(idToken)`, `appleSignIn(idToken, name?)`, `linkOAuth(...)`, `unlinkOAuth(...)`.
- `apps/dashboard/src/components/SocialAuthButtons.tsx` — two-button block: "Continue with Google" + "Continue with Apple". Used by the login screen and the Settings → Connected accounts section. Shows the in-progress spinner per provider, surfaces `OAUTH_EMAIL_CONFLICT` inline.

**Files to modify:**
- `apps/dashboard/src/pages/login.tsx` — under the phone form, add a divider + `<SocialAuthButtons />`. Mobile-first: stacked, full-width buttons, 12px gap, 44px min height. Brand styling per provider's published guidelines (light Google button on cream, black Apple button — both exceptions to the cream/gold palette per the rules).
- `apps/dashboard/src/pages/tabs/settings.tsx` — add a "Connected accounts" section with three rows (Phone, Google, Apple). Each row shows current state + Connect/Disconnect.
- `apps/dashboard/index.html` — preconnect to `accounts.google.com` and `appleid.cdn-apple.com` so the script loads aren't a cold round trip.
- `apps/dashboard/vite.config.ts` — env: `VITE_GOOGLE_CLIENT_ID`, `VITE_APPLE_SERVICE_ID`, `VITE_APPLE_REDIRECT_URI`.

**i18n** — `auth.social.continueWith.google`, `auth.social.continueWith.apple`, `auth.social.divider` ("or"), `settings.connectedAccounts.title`, plus error keys `errors.oauthEmailConflict`, `errors.oauthGenericFailure`, `errors.cannotUnlinkLastMethod`. All three locales.

## Infra / configuration (out-of-scope for the code task, but needed before it ships)

- **Google Cloud Console**: create OAuth 2.0 web client for `https://app.bookla.az` (and `http://localhost:5173` for dev). Authorize the JS origin. Copy the client ID into `VITE_GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_IDS`.
- **Apple Developer**: paid Apple Developer Program enrollment required. Create a Services ID (e.g. `az.bookla.web`), enable "Sign in with Apple", register the domain + return URLs. Copy the Services ID into `VITE_APPLE_SERVICE_ID` + `APPLE_SERVICE_ID`.
- Apple **private email relay**: Apple may return a `@privaterelay.appleid.com` address. Treat it as a real email; never use it for SMS recovery prompts. Set `isPrivateEmailRelay` on the verified payload so the UI can hide "we'll text you here" hints.

## Acceptance

- `POST /auth/google` with a valid Google ID token issued for `GOOGLE_CLIENT_IDS` → 200, returns `{ token, user, tenant: null }` on first sign-in; subsequent sign-ins return the same user.
- `POST /auth/apple` with a valid Apple identity token → 200 likewise.
- Invalid signature, wrong `aud`, wrong `iss`, or expired → 401 `OAUTH_INVALID_TOKEN`.
- Email-collision flow: existing phone-user with email `x@y` cannot be auto-claimed by a Google sign-in with the same email — API returns `400 OAUTH_EMAIL_CONFLICT`, UI shows the linking guidance.
- A user who signed up via Google can go to Settings → Connected accounts → Connect Phone, complete an OTP, and end up with both identities. Disconnecting either still leaves a working sign-in method; disconnecting the last one returns `400 CANNOT_UNLINK_LAST_METHOD`.
- Lighthouse PWA stays ≥ 90 (no regressions from the SDK scripts; both load via `preconnect` and `defer`).
- `pnpm typecheck` clean. The OTP path still works untouched.

## Notes

- Do NOT implement Facebook/Twitter/etc. Two providers is the sweet spot — every extra one adds review surface and rarely moves install rates.
- Token verification happens **server-side**. Never trust a client-supplied `sub` or `email`; only what the JWKS-verified payload says.
- The storefront (`apps/storefront`) does NOT get social sign-in. Clients book without an account in the MVP; this is a dashboard-owner feature.
- If we later ship a native iOS shell (Capacitor/RN), the same `/auth/google` and `/auth/apple` endpoints accept native-issued tokens — different `aud` claims, which is why `GOOGLE_CLIENT_IDS` is a CSV.
