# 24 — Native app shell + push notifications

Ship `apps/dashboard` as a native iOS app (then Android) via Capacitor, with real APNs/FCM push for the bookings the tenant owner cares about. The PWA stays as-is; Capacitor wraps the same React build in a native shell so we reuse ~95% of the existing code and don't fork the codebase. Migration to a full Expo / React Native UI is a separate future task if we ever want it — this task is the pragmatic path to push + store presence.

Depends on: **13** (Settings — push toggle lives there), **14** (messaging-cron — staff reminders piggyback on the same scheduler).

## Milestones (build in order)

### M1 — Backend push infrastructure

This is the hardest and least visible part. Do it first; everything else is mechanical once it's solid.

**Schema** — new `prisma/schema/devices.prisma`:

```prisma
model Device {
  id          Int      @id @default(autoincrement())
  userId      Int      @map("user_id")
  user        TenantUser @relation(fields: [userId], references: [id], onDelete: Cascade)

  platform    DevicePlatform                         // ios | android
  fcmToken    String   @unique @map("fcm_token")     // Firebase token; FCM bridges to APNs on iOS
  deviceLabel String?  @map("device_label")          // optional UA / model string for the user

  createdAt   DateTime @default(now()) @map("created_at")
  lastSeenAt  DateTime @default(now()) @map("last_seen_at")

  @@index([userId])
  @@map("devices")
}

enum DevicePlatform { ios android }
```

One token per device. FCM on both platforms — Capacitor's `@capacitor/push-notifications` plugin uses FCM internally and FCM forwards to APNs on iOS, so we have one token type to manage server-side. Avoids juggling APNs keys directly.

**Push send abstraction** — new `packages/push/`:

```ts
// packages/push/index.ts
interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;  // for deep-linking
}

export interface PushProvider {
  sendToTokens(tokens: string[], payload: PushPayload): Promise<{ sent: number; failed: string[] }>;
}

export class ConsolePushProvider implements PushProvider { ... }   // dev: log to stdout
export class FcmPushProvider implements PushProvider { ... }       // prod: Firebase Admin SDK
```

Mirrors `packages/messaging`'s shape so the abstraction is familiar. Selected via `PUSH_PROVIDER` env var.

**API endpoints** — new `apps/api/routes/devices/`:

- `POST   /devices` — register a token (auth required). Upserts on `fcmToken`, sets `userId` + `lastSeenAt`. Idempotent.
- `DELETE /devices/:id` — unregister (signed out, push toggled off).
- `PATCH  /devices/:id/heartbeat` — bump `lastSeenAt` (call on app open so we can prune stale tokens later).

**Event wiring** — push the relevant users at each lifecycle event:

| Event | Where it fires | Who gets pushed | Copy template |
|---|---|---|---|
| New public booking created | `apps/api/routes/public/public.service.ts:createPublicBooking` (inside the same tx OR a post-commit hook, see "Atomicity" below) | Owner + assigned staff | "New booking — {clientName} at {time}" |
| Booking cancelled by client | future cancel endpoint (task 10 / 09 extension) | Owner + assigned staff | "Cancelled — {clientName} {date} {time}" |
| Upcoming-booking reminder | `apps/cron` (task 14) | Assigned staff only | "In 30 min — {clientName}, {service}" |
| Late client / no-show alert | `apps/cron` after task 22 lands | Assigned staff only | "{clientName} hasn't arrived ({minutes} min late)" |

**Atomicity decision**: push send must NOT live inside the booking transaction (network call inside a serialisable tx is a recipe for retry-storm + duplicate pushes). Instead, on successful commit, enqueue a job — for MVP, that's a fire-and-forget call after the tx returns, wrapped in a try/catch that logs but doesn't fail the booking. Document this clearly in the service file.

**Notification ledger**: extend the existing `Notification` table (`type` enum) with `push_*` values, or add a parallel `PushDeliveryLog` table for retries. Pick one when implementing; the SMS-side `Notification` model is already audit-friendly so reusing it is probably cleaner.

### M2 — iOS native shell (TestFlight-shippable)

- Add Capacitor to `apps/dashboard`: `pnpm add @capacitor/core @capacitor/cli @capacitor/ios @capacitor/push-notifications`, then `npx cap init "Bookla" "com.bookla.dashboard"`.
- `npx cap add ios` — generates `apps/dashboard/ios/`.
- Build target points at the dashboard's `dist/` (the PWA build). Capacitor copies on `npx cap sync`.
- Native config:
  - Bundle ID, signing identity, push capability enabled in Xcode.
  - Apple Developer account + APNs key uploaded to Firebase Console.
  - Firebase iOS app registered, `GoogleService-Info.plist` checked in (NOT to public repo — secrets handling TBD).
- App lifecycle hooks in the React layer:
  - On app open: ask for push permission (gated by a "first booking received" milestone OR a one-time onboarding card — DON'T prompt on cold start before they've used the app, iOS denies permanently if they tap "Don't Allow").
  - On grant: receive FCM token via Capacitor plugin → `POST /devices`.
  - On token refresh: PATCH device row.
  - On sign out: `DELETE /devices/:id`.
  - Foreground push: show an in-app toast (PWA already has Sonner-ish surface? if not, add a minimal one).
  - Background push tap: parse `data.bookingId`, route to `/bookings/:id`.
- App Store Connect: create the listing, screenshots, privacy nutrition labels (we collect phone, device tokens — declare it), ship to TestFlight internal testing.

### M3 — Android (post-iOS validation)

- `npx cap add android` → `apps/dashboard/android/`.
- Firebase Android app, `google-services.json` checked in (same secrets handling as iOS plist).
- Notification channels: one channel for "Bookings", default importance HIGH, sound on.
- Adaptive launcher icon + splash from the existing PWA assets.
- Google Play Console listing, closed testing track first, then production.

## Permission UX rules (non-negotiable)

- Never prompt for push on cold start. Show a custom prepermission card explaining *why* ("get pinged the moment a client books") with a clear "Turn on notifications" button. Only then call the system prompt. Once denied at OS level, you can't ask again — so the prepermission card is the single shot we get.
- Settings tab (task 13) gets a "Notifications" toggle. Off → `DELETE /devices/:id`. On → re-request permission + register.

## Out of scope

- **Full Expo / React Native rebuild.** This is the wrapper strategy; the UI is the same React PWA. A native rebuild is a separate future task only if Capacitor proves limiting.
- **Rich push (images, action buttons).** Text + tap-to-open is enough for MVP.
- **iOS Live Activities / Dynamic Island.** Cool, not MVP.
- **In-app message centre.** Push is fire-and-forget; the booking row in the calendar is the source of truth for what happened.
- **Per-tenant notification customisation** (custom sounds, quiet hours, etc.). Sensible defaults only.
- **SMS-to-push migration.** SMS reminders (task 14) keep going; push is an additional channel, not a replacement.
- **End-user (client) push.** This task is for tenant owners/staff. The booking client gets confirmation via SMS (task 14) — they don't have the native app.

## Acceptance

- M1 alone: `POST /devices` accepts a token, returns 201. A booking created via the storefront causes an entry in the push log AND (with `PUSH_PROVIDER=console`) logs the payload to API stdout. The booking transaction commits even if the push provider throws.
- M2: A TestFlight build installs on an iPhone. Booking a slot via the storefront causes a notification banner on the test device within ~5 seconds. Tapping the notification opens the dashboard at the booking detail.
- M3: Same as M2 but on an Android device via a Google Play internal testing build.
- All four push events (new / cancel / reminder / late) deliver end-to-end on both platforms.
- Disabling notifications in Settings deletes the device row AND the token doesn't receive further pushes.
- Permission UX: cold-start of a fresh install does NOT trigger the system permission prompt.

## Risks / known unknowns

- **iOS push reliability**: APNs has its own quirks (silent vs alert, throttling on rapid sends). Test with rapid back-to-back bookings during M2.
- **Token rotation**: FCM rotates tokens for various reasons (app reinstall, device restore). The `lastSeenAt` heartbeat lets us prune dead tokens periodically — add a cron job in task 14's scheduler.
- **Secrets in repo**: `GoogleService-Info.plist` and `google-services.json` contain Firebase project IDs (not super-sensitive, but conventionally not in public repos). Decide handling — env-var template + scripted generation, or `.gitignore`d files checked into the deploy pipeline.
- **Apple developer account**: $99/yr, takes ~24h to provision. Get this started early.
