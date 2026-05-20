# 22 — Lateness tracking

Let tenants record when a client arrived late (separate from `no_show`), so repeat offenders are visible on the client detail and can inform blocking decisions.

Depends on: **09** (dashboard calendar / booking-detail UI ships the status-change buttons; this adds one more action), **11** (client detail surfaces the lateness count + history).

## Status today

`BookingStatus` enum is `confirmed / cancelled / completed / no_show`. There's no in-between for "they came, but late". Tenants today have two blunt tools: free-form `Client.notes` or the per-tenant blocklist (task 12). Neither aggregates.

## Open design decisions (decide when this task is picked up)

Three shapes were discussed; we deferred to here:

1. **`Booking.arrivedLate Boolean @default(false)`** — simplest. One column, one toggle in the booking-detail UI. Coexists with `status` (you can be `completed` *and* `arrivedLate`). Counts roll up trivially per-client. Doesn't record *how* late.
2. **`Booking.minutesLate Int @default(0)`** — more nuanced. Quick-pick (5/10/15/30+) at logging time. Powers "avg late minutes" stats (task 15). More UX friction.
3. **Add `late` to `BookingStatus`** — collapses lateness into status. Loses the natural "completed AND late" combination; treats late-arrival as the booking's terminal state.

Pre-pick: **(1)** if we don't yet have appetite for stats; **(2)** if task 15 stats want lateness metrics; avoid **(3)** unless we re-think the whole status enum.

## In scope when picked up

- Prisma migration adding the chosen field to `Booking`. Default is false/0 so the backfill is automatic for existing rows.
- API: extend the booking-update endpoint (added in task 09 / 10) to accept the new field. RBAC: same role as marking complete/no-show.
- Dashboard: one more action button on the booking-detail surface (task 09). Inline in the calendar context, NOT a separate flow.
- Client detail (task 11): show a small "late N×" badge derived from a count over the client's confirmed/completed bookings. Source of truth is the new field.

## Explicitly NOT in scope

- Automatic blocking after N late arrivals — too easy to get wrong. Keep blocking manual (task 12 already ships it). We can revisit once we have real data.
- Customer-facing "I'm running late" check-in — different feature, different surface, possible post-MVP.
- Notifications to staff when a booking is "about to be late" (e.g., 5 minutes past start with no check-in). Adjacent feature; queue separately if we want it.

## Acceptance

- A `confirmed` booking can be flipped to `completed + arrivedLate=true` via one tap on the booking-detail screen.
- The flag survives a page reload and is visible on the booking-detail.
- The client-detail screen shows the cumulative count of late arrivals for that client across their booking history.
- Setting `arrivedLate=true` on a `no_show` booking is rejected at the API boundary — the two states are mutually exclusive.
