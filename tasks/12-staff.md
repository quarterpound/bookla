# 12 — Staff management (plan-gated)

Multiple active staff are gated behind `Tenant.plan = 'business'`.

Depends on: **01**, **05**, **06**.

## API — `apps/api/routes/staff/`

- `GET /staff` — list (active + inactive).
- `POST /staff` — create. **Gate:** if tenant's plan is `personal` AND there is already one active staff row, return `PLAN_LIMIT_REACHED` (409). The owner's own `Staff` row (created during onboarding) is the one allowed slot.
- `GET /staff/:id`, `PATCH /staff/:id`, `DELETE /staff/:id` (soft-deactivate).

DTO: `packages/dto/staff.ts`.

## Plan gate helper

Add to `apps/api/utils/` (e.g., `plan.ts`): `assertCanAddActiveStaff(tenantId)` that throws `AppError('Plan limit reached', 'PLAN_LIMIT_REACHED', 409)` per plan §8.

Reuse this helper anywhere else that needs a plan check.

## Dashboard

- `apps/dashboard/src/pages/settings/staff.tsx` — list, add, edit, deactivate. On `personal` plan, the "+ Add staff" button is disabled with an inline "Upgrade to Business to add more staff" CTA linking to `/settings/billing`.

Each staff row links to a schedule editor (reusing task **06**'s `/schedule/:staffId/working-hours` UI). Allow setting per-staff working hours and days off.

## Acceptance

- On `personal` plan, attempting to add a second active staff returns 409 `PLAN_LIMIT_REACHED`.
- Flip `Tenant.plan` to `business` in Studio → second staff add succeeds.
- Deactivating a staff hides them from the public booking flow (task **08**) and the manual booking flow (task **10**) but preserves their past bookings.
