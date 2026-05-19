# 06 — Schedule: work intervals + days off

Needed before slots can be calculated. Owners set their recurring weekly schedule (potentially with split shifts — e.g. 09:30–10:30 then 12:30–14:30) and mark full days off.

Depends on: **01**, **02**, **03**, **04**.

## Why this replaces the original `WorkingHours` model

Real owners (barbers, beauticians) often work split shifts: open in the morning, closed midday, reopen in the afternoon. They also frequently want multiple breaks (e.g. short coffee at 11, longer lunch at 13). The original schema (`WorkingHours` with `startTime`/`endTime` + one optional break) only supports a single contiguous range minus one gap — not flexible enough.

This task replaces `WorkingHours` with `WorkingInterval`: one DB row per work window, **N rows per (staffId, dayOfWeek)**. Days off are then just the absence of rows for that day (recurring) or a `DayOff` row (one-off date override).

## Database — `prisma/schema/schedule.prisma`

**Drop `WorkingHours`** (only used by seed + onboarding so far; no production data).

**Add `WorkingInterval`:**
```
WorkingInterval {
  id        Int
  staffId   Int        @map("staff_id")
  staff     Staff      @relation(..., onDelete: Cascade)
  dayOfWeek Int        @map("day_of_week")   // 0=Mon ... 6=Sun
  startTime String     @map("start_time")    // "09:30"
  endTime   String     @map("end_time")      // "10:30"
  createdAt / updatedAt
  @@index([staffId, dayOfWeek])
  @@map("working_intervals")
}
```

No uniqueness constraint on `(staffId, dayOfWeek)` — that's the whole point; multiple rows per day are the norm now.

`DayOff` stays as-is (whole-date toggle).

**Migration mechanics:** since `WorkingHours` only has seed + onboarding-created rows, the migration drops the table and creates the new one. Seed (`prisma/seed.ts`) gets rewritten to insert `WorkingInterval` rows for Tural's Barbershop — e.g. morning 09:00–13:00 and afternoon 14:00–19:00 (two rows per Mon–Sat).

## Cascade — also part of this task

- `apps/api/routes/auth/auth.service.ts` → `completeOnboarding`: replace `workingHours.createMany` (the old `WorkingHours` shape) with one `WorkingInterval` row per selected day. The onboarding wizard still sends a single shared range per day (no split-shift UI at onboarding); split-shift editing lives in the Schedule screen this task ships.
- `packages/dto/auth.ts` → `workingHoursEntryDto`: drop the `breakStartTime`/`breakEndTime` fields. The onboarding wizard already only sets `startTime`/`endTime`.
- `packages/db/index.ts`: drop the `WorkingHours` re-export, add `WorkingInterval`.

## API — `apps/api/routes/schedule/`

- `GET /schedule/:staffId/intervals` — returns all `WorkingInterval` rows for that staff, ordered by `(dayOfWeek, startTime)`. Cross-tenant access returns 404.
- `PUT /schedule/:staffId/intervals` — body is the **full week** as an array of `{ dayOfWeek, startTime, endTime }`. **Idempotent replace**: delete all existing rows for that staff inside a transaction, insert the new set. Validates per-interval `endTime > startTime`, and that intervals within the same `dayOfWeek` don't overlap (sort by `startTime`, check sequential).
- `GET /schedule/:staffId/days-off` — list upcoming (optional `from`/`to` query).
- `POST /schedule/days-off` — `{ staffId, date, reason? }`.
- `DELETE /schedule/days-off/:id`.

All scoped to `c.get('user').tenantId` — verify the staff belongs to the tenant before mutating.

**Soft limits** (enforced in the service layer, not the schema): max 6 intervals per dayOfWeek. Anything beyond that is almost always a UI mistake.

## DTO — `packages/dto/schedule.ts`

```ts
const timeStringValidator = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

workingIntervalDto = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: timeStringValidator,
  endTime:   timeStringValidator,
}).refine(v => v.endTime > v.startTime, { message: 'endTime must be after startTime' });

workingIntervalsWeekDto = z.array(workingIntervalDto).max(7 * 6);

dayOffCreateDto = z.object({
  staffId: z.number().int().positive(),
  date:    z.coerce.date(),
  reason:  z.string().trim().max(200).optional(),
});
```

`startTime` / `endTime` stay as `"HH:mm"` strings. The slot engine parses them.

## Dashboard

- `apps/dashboard/src/pages/schedule/index.tsx` — weekly editor. Each of the 7 days renders:
  - A "Closed" / "Open" toggle (toggle off = remove all intervals for that day).
  - When Open: a list of interval rows, each with two native `<input type="time">` controls + a remove button.
  - "+ Add interval" appends a new row (defaults to a sensible next slot — e.g. an hour after the last interval ends, or 09:00 if first).
  - Validation hints inline (overlap warning, end-before-start error).
  - "Save" button at the bottom does the full-week PUT.
- `apps/dashboard/src/pages/schedule/days-off.tsx` — calendar with tappable future dates → opens `Sheet` → confirm with optional reason.
- Settings tab gets a "Schedule" row that pushes to `/schedule`.

For MVP the owner edits **their own** `Staff` row's schedule. Multi-staff scheduling lives behind task **12**'s plan gate; the same `/schedule/:staffId/intervals` API is reused with a different `staffId`.

## Acceptance

- PUT a week with two intervals on Monday (09:30–10:30 + 12:30–14:30) → GET returns those two rows for `dayOfWeek=0`, plus whatever else for other days.
- PUT with `endTime <= startTime` → 400.
- PUT with two intervals on the same day that overlap (09:00–11:00 + 10:30–13:00) → 400 `OVERLAPPING_INTERVALS`.
- POST a day-off → GET lists it → DELETE removes it.
- Cross-tenant access (signed-in user A passing staff B from tenant B) → 404 (not 403, to avoid leaking existence).
- Mobile UX: time pickers are native `<input type="time">` (not custom dropdowns). No horizontal scroll at 375px even with 4 intervals on one day.
- Slot engine (task **07**) treats `WorkingInterval` rows as the open windows; no extra break-subtraction logic needed because gaps between intervals are already closed.

## Notes

- **Why no overlap check at the DB level:** Postgres has no range-type-by-default for `text` time strings, and forcing a composite index doesn't catch overlap. The check belongs at the service layer where we can read the day's set, sort, and validate. Adding `tstzrange` later if/when we move to real `time` columns is reasonable.
- **One-off partial blocks** ("I'm out 2–3pm on Thursday for a dentist appointment") are NOT in scope. The closest is a `DayOff` (whole-date). The proper fix is a `TimeOff` model (`staffId`, `date`, `startTime`, `endTime`) the slot engine subtracts from the recurring week. Listed here so it's not forgotten; add when the first user asks.
- **Multi-break** is now trivial: it's just N intervals with gaps between them. The user gets coffee at 11:00, lunch at 13:00, second coffee at 16:00 by creating 4 intervals.
