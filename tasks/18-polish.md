# 18 — End-to-end polish

Final pass before MVP launch. Covers the verification checklist in `plans/mvp-adapted.md` §"Verification".

Depends on: everything 01–17.

## Work

- Sweep every page for loading / empty / error states. Replace any remaining spinners with skeletons; every empty state should have copy + a primary action.
- Responsive sweep up to 1280px. Dashboard stays usable on a laptop (single readable column, bottom tab bar can flip to a side rail at ≥ 768px — optional).
- Storefront responsive sweep: phone (primary), tablet, desktop.
- Run `pnpm typecheck && pnpm lint && pnpm build` across the workspace — all clean.
- Run `pnpm vitest packages/slots` — all green.
- Walk the §Verification checklist end-to-end:
  1. Install / generate / migrate / seed.
  2. Auth bypass code path.
  3. Onboarding fresh-tenant flow.
  4. Services creation + visibility on `/b/<slug>`.
  5. Slots correctness given seed schedule + past-time filter.
  6. Booking creation + confirmation + `Notification` row.
  7. Race-safety (two parallel POSTs → exactly one wins).
  8. Calendar shows the booking.
  9. Manual booking with overlap → rejected.
  10. Plan gate → second staff blocked on personal; flip to business → allowed.
  11. Reminder cron writes one row, re-run is idempotent.
  12. Mobile / PWA checks (375px, safe-area, Lighthouse, iOS A2HS, airplane mode).
  13. Auth transport check: cookie path AND Bearer path both work end-to-end.

## Acceptance

- All 16 items in `plans/mvp-adapted.md` §"Verification" pass.
- `pnpm build` clean across all workspaces.
- README in repo root updated with run instructions if anything diverged.

## Notes

- Anything caught here that isn't a polish item but a real bug → file a follow-up task; don't try to bundle it into the polish PR.
