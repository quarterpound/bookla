# 15 — Stats dashboard (plan-gated)

Business-plan only. Read-only aggregates.

Depends on: **08**, **10**, **12**.

## API — `apps/api/routes/stats/`

Gate: if `tenant.plan !== 'business'`, return `PLAN_LIMIT_REACHED` (reuse the helper from task **12**).

- `GET /stats/overview?range=7d|30d|90d` → `{ totalBookings, completed, cancelled, noShow, revenueQepik, topServices: [...], topStaff: [...] }`.

Sum `service.priceAmount` for `status='completed'` bookings in range. Cancelled/no-show do not count toward revenue.

DTO: `packages/dto/stats.ts`.

## Dashboard

- `apps/dashboard/src/pages/settings/stats.tsx` — KPI tiles + a simple bar chart per service (recharts is fine for one chart, otherwise hand-roll).
- On `personal` plan, the row in Settings is shown with a lock icon + upgrade CTA.

## Acceptance

- Personal plan tenant gets 409 from the endpoint and a paywall in the UI.
- Business plan tenant sees real numbers that match seed data.
- Range switch refetches and updates the chart.
