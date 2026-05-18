# 06 — Schedule: working hours + days off

Needed before slots can be calculated.

Depends on: **01**, **02**, **03**, **04**.

## API — `apps/api/routes/schedule/`

- `GET    /schedule/:staffId/working-hours` — returns the 7 rows (or fewer) for that staff.
- `PUT    /schedule/:staffId/working-hours` — body is the **full** week (idempotent replace). Validates `endTime > startTime`, optional break inside the window.
- `GET    /schedule/:staffId/days-off` — list upcoming (optional `from`/`to` query).
- `POST   /schedule/days-off` — `{ staffId, date, reason? }`.
- `DELETE /schedule/days-off/:id`.

All scoped to `c.get('user').tenantId` — verify the staff belongs to the tenant before mutating.

## DTO — `packages/dto/schedule.ts`

- `workingHoursWeekDto` (array of 0–7 entries, dayOfWeek unique).
- `dayOffCreateDto`.

`startTime`/`endTime` are `"HH:mm"` strings. Validate with a regex; the slot engine will parse them.

## Dashboard

- `apps/dashboard/src/pages/schedule/index.tsx` — weekly grid (7 rows). Each row: toggle "open", two time pickers, optional break. Save replaces the week.
- `apps/dashboard/src/pages/schedule/days-off.tsx` — calendar with tappable future dates → opens sheet → confirm with optional reason.
- Settings tab gets a "Schedule" row.

For MVP, the owner edits their own `Staff` row's schedule. Multi-staff scheduling lives behind task **12**'s plan gate.

## Acceptance

- PUT the week → GET returns it exactly.
- POST a day-off, GET lists it, DELETE removes it.
- Cross-tenant access blocked (403/404).
- Mobile UX: time pickers are native inputs, not custom dropdowns. No horizontal scroll at 375px.
