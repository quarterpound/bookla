# 17 — PWA polish & install prompt

Push the dashboard's PWA from "installable" to "feels like a native app."

Depends on: **03**.

## Work

- **Install prompt component:** listens for `beforeinstallprompt`, shows a one-time banner (dismissable, remembers dismissal in localStorage), triggers the prompt on tap.
- **App shortcuts** in `manifest.webmanifest`:
  - "Add Booking" → `/bookings/new`
  - "Today's Schedule" → `/calendar`
- **Pull-to-refresh** on Calendar and Clients tabs. Custom hook (~30 lines), no heavy library.
- **Offline shell:** confirm the service worker (configured in task 03) serves the app shell when offline; show a sane "You're offline" banner in `AppShell` when `navigator.onLine` is false.
- **Skeleton loaders** everywhere a fetch is in flight (replace any spinners that crept in during feature work).

## Acceptance

- Lighthouse "Installable PWA" audit **≥ 90** in Chrome devtools.
- On iOS Safari, "Add to Home Screen" produces an icon that opens the dashboard standalone with the correct theme color and no browser chrome.
- Toggling airplane mode after a first load → app shell still renders; the offline banner appears; navigating between cached pages works.
- App shortcuts visible on long-press of the installed icon on Android.
- Pull-to-refresh triggers a refetch on Calendar and Clients, with visible feedback.
