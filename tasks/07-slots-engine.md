# 07 — `packages/slots` engine + tests

The heart of the app. **Pure functions, no DB, no I/O.** Heavy tests live here.

Depends on: **01**.

## Package — `packages/slots/`

- `package.json` — workspace package, vitest configured.
- `index.ts`:

```ts
export const SLOT_INTERVAL_MINUTES = 15;

export interface SlotInput {
  workingHours: { startTime: string; endTime: string; breakStartTime?: string; breakEndTime?: string } | null;
  isDayOff: boolean;
  existingBookings: { startTime: string; endTime: string }[]; // CONFIRMED only
  serviceDurationMinutes: number;
  nowInBusinessTz: { date: string; time: string } | null;     // if same-day, filter past slots
}

export const getAvailableSlots = (input: SlotInput): string[];
export const slotsOverlap = (aStart: string, aEnd: string, bStart: string, bEnd: string): boolean;
export const addMinutes = (hhmm: string, minutes: number): string;
```

## Tests — `packages/slots/__tests__/slots.test.ts`

Cover at minimum:
- Empty day (no working hours OR `isDayOff: true`) → `[]`.
- Plain day, no bookings, 30-minute service → expected slots at 15-minute granularity, last slot ends ≤ `endTime`.
- Break overlap: slots overlapping the break window are excluded; service that would span the break is excluded.
- End-of-day overflow: slot whose end exceeds `endTime` is dropped.
- Multiple existing bookings: any slot overlapping any confirmed booking is excluded.
- Same-day past-time filtering: when `nowInBusinessTz.date` matches the slot date, slots starting before `nowInBusinessTz.time` are dropped.
- `slotsOverlap` edge cases: adjacent (end == start) is **not** overlap; identical ranges overlap; one inside the other overlaps.

## API integration

In `apps/api/routes/bookings/bookings.service.ts` (created in task **08**), add a `getSlotsForStaffDate(tenantId, staffId, serviceId, date)` wrapper that:
1. Loads service (for `durationMinutes`).
2. Loads `WorkingHours` for `(staffId, dayOfWeek)`.
3. Checks `DayOff` for `(staffId, date)`.
4. Loads confirmed `Booking` rows for `(staffId, date, status=confirmed)`.
5. Computes "now in business tz" from `tenant.timezone`.
6. Calls `getAvailableSlots(...)`.

This wrapper is consumed by both the public slots endpoint (task **08**) and the manual booking flow (task **10**).

## DTO follow-up

Now that `SLOT_INTERVAL_MINUTES` exists, update `packages/dto/services.ts` (task **05**) to enforce `durationMinutes % 15 === 0`.

## Acceptance

- `pnpm vitest packages/slots` — all tests green.
- TypeScript clean across consumers.
- `tsconfig.json` path alias `@bookla/slots` (or whatever the package name resolves to) works in both `apps/api` and `apps/storefront`.
