# 16 — Billing page (informational)

No payments. Just a screen that explains plans and the current state. Future Stripe integration plugs in here.

Depends on: **04**, **12**.

## Dashboard — `apps/dashboard/src/pages/settings/billing.tsx`

- Show the tenant's current plan (`personal` or `business`).
- Two cards (Personal / Business) with what each includes:
  - **Personal**: 1 staff, online booking, manual booking, reminders, clients.
  - **Business**: everything above + multiple staff + stats dashboard.
- "Upgrade" button is non-functional for MVP — show a "Coming soon" toast OR a `mailto:` link.

No API work in this task. Plan is flipped manually in Prisma Studio for now.

## Acceptance

- Page renders cleanly at 375px.
- Reflects the live `Tenant.plan` value.
- Upgrade CTA does not 500; it just informs.
