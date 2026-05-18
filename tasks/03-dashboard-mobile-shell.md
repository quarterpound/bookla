# 03 — Dashboard mobile shell + PWA

Build the mobile-app-first chassis **before** any feature page. This is the design contract; every later screen plugs in here. If you skip this and write a desktop-shaped page first, you will refactor it later.

Depends on: nothing strictly, but feature tasks (05+) depend on this.

## Design rules (non-negotiable)

- Every screen designed at **375 × 812 portrait first**. Desktop is scale-up, not the design target.
- Bottom tab bar: **Calendar · Bookings · Clients · Settings**. Stats/Billing live under Settings (or as a "More" sheet on Business plan).
- Routes are full-screen, not modals. Editing = pushed route with back button.
- Touch targets ≥ 44×44px. No hover-only affordances. No tiny icon-only buttons without labels.
- Sticky FAB on Calendar for "+ Add booking".
- Skeleton loaders, not spinners. Illustrated, actionable empty states.
- Safe-area insets respected (`env(safe-area-inset-*)`) so the tab bar sits above the iOS home indicator.

## PWA setup (ship with MVP)

- Install `vite-plugin-pwa`, configure in `apps/dashboard/vite.config.ts`.
- `apps/dashboard/public/manifest.webmanifest`: `name`, `short_name="Bookla"`, `display="standalone"`, `start_url="/"`, `scope="/"`, theme + background colors matching the cream/gold palette.
- Maskable icons at 192/512px + Apple touch icons, generated from one source SVG.
- Workbox service worker: precache app shell; runtime-cache `GET /api/*` network-first with short TTL; skip mutations.
- `apps/dashboard/index.html`: `theme-color`, `apple-mobile-web-app-capable=yes`, `viewport-fit=cover`, themed status-bar meta.

The install-prompt component and app-shortcuts manifest entries are deferred to **17**.

## Layout primitives — `apps/dashboard/src/components/ui/`

Minimal, hand-rolled with Tailwind. **No Radix/MUI/Chakra.**

- `AppShell` — header (title + optional right action), bottom tab bar, content area with safe-area padding.
- `BottomTabBar` — fixed tabs with icons + labels and active state.
- `Sheet` — slide-up sheet for short forms.
- `Button`, `Input`, `TextArea`, `Select`, `DatePicker`, `TimeSlotGrid`, `EmptyState`, `Skeleton`.

## Files

**Modify:**
- `apps/dashboard/vite.config.ts` — `vite-plugin-pwa` config.
- `apps/dashboard/index.html` — PWA meta tags.
- `apps/dashboard/tailwind.config.ts` — cream/gold theme tokens, safe-area utilities (`pt-safe`, `pb-safe`, etc.).
- `apps/dashboard/src/router.tsx` — define `(tabs)` group rendered inside `AppShell` (placeholder route children are fine for now).

**Create:**
- `apps/dashboard/public/manifest.webmanifest` + icon assets.
- `apps/dashboard/src/components/ui/*` (the primitives above).

## Acceptance

- `pnpm dev:dashboard` boots; the shell renders at 375px without horizontal scroll.
- Bottom tab bar shows 4 tabs and sits above safe-area inset on iOS preview.
- Lighthouse "Installable PWA" audit ≥ 60 at this stage (≥ 90 target is task 17).
- `pnpm typecheck` clean.

## Notes

- Do not build feature pages here. This task ships scaffolding only — feature tasks (05, 09, 11, 12, etc.) will fill in the tab contents.
