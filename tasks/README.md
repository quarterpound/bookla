# Bookla MVP Tasks

Tasks derived from [`plans/mvp-adapted.md`](../plans/mvp-adapted.md). One file per milestone, in the order they should be built. Each task is independently deployable; later tasks assume earlier ones are merged.

Task numbering matches the **Build order** section of the adapted plan.

| # | Task | Touches |
|---|---|---|
| 01 | [Schema migration & seed](./01-schema-migration.md) | `prisma/` |
| 02 | [Phone+OTP auth (API)](./02-otp-auth-api.md) | `apps/api`, `packages/dto`, `packages/messaging` |
| 03 | [Dashboard mobile shell + PWA](./03-dashboard-mobile-shell.md) | `apps/dashboard` |
| 04 | [Dashboard auth UI](./04-dashboard-auth-ui.md) | `apps/dashboard` |
| 05 | [Services CRUD](./05-services-crud.md) | `apps/api`, `apps/dashboard`, `packages/dto` |
| 06 | [Schedule (working hours + days off)](./06-schedule.md) | `apps/api`, `apps/dashboard`, `packages/dto` |
| 07 | [`packages/slots` engine + tests](./07-slots-engine.md) | `packages/slots`, `apps/api` |
| 08 | [Storefront scaffold + public booking flow](./08-storefront-public-booking.md) | `apps/storefront`, `apps/api` |
| 09 | [Dashboard calendar view](./09-dashboard-calendar.md) | `apps/dashboard` |
| 10 | [Manual booking flow](./10-manual-booking.md) | `apps/api`, `apps/dashboard` |
| 11 | [Client list](./11-clients.md) | `apps/api`, `apps/dashboard` |
| 12 | [Staff management (plan-gated)](./12-staff.md) | `apps/api`, `apps/dashboard` |
| 13 | [Business settings + share link](./13-settings.md) | `apps/api`, `apps/dashboard` |
| 14 | [Messaging integrations + reminder cron](./14-messaging-cron.md) | `packages/messaging`, `apps/api`, `apps/cron` |
| 15 | [Stats dashboard (plan-gated)](./15-stats.md) | `apps/api`, `apps/dashboard` |
| 16 | [Billing page (informational)](./16-billing.md) | `apps/dashboard` |
| 17 | [PWA polish & install prompt](./17-pwa-polish.md) | `apps/dashboard` |
| 18 | [End-to-end polish](./18-polish.md) | all |

See [`plans/mvp-adapted.md`](../plans/mvp-adapted.md) §"Verification" for the end-to-end check list once everything is wired.
