# 09 — Dashboard calendar view

The primary screen tenants see. Day view first; week view toggle.

Depends on: **03**, **08** (need bookings to display).

## API — `apps/api/routes/bookings/`

(Created in task **08** alongside `public.controller`.) Add the protected sibling:

- `GET /bookings?from=YYYY-MM-DD&to=YYYY-MM-DD&staffId?` — range query for the calendar.
- `PATCH /bookings/:id` — status (`confirmed → cancelled | completed | no_show`), notes, or reschedule (requires the same atomic conflict check as creation).

## Dashboard — `apps/dashboard/src/pages/(tabs)/calendar.tsx`

- Default: **day view**. Show staff column(s) for the selected date with confirmed + completed + no-show bookings rendered as cards positioned by start time.
- Swipe gestures to move ±1 day. Header shows the date + an inline date picker.
- Toggle in the header switches to **week view** — 7 columns, compact card height.
- Sticky FAB "+ Add booking" routes to `bookings/new` (task **10**).
- Tap a booking card → routes to `bookings/$id` (task **10** also covers this page).

`apps/dashboard/src/pages/(tabs)/bookings.tsx` — flat list view as an alternative entry to the same data. Filter chips by status.

## Acceptance

- Today shows seeded bookings in the right slots.
- Swiping moves the day; the range query refetches once per day-change (debounce gentle).
- Week view is usable at 375px (compact cards, horizontal scroll within the view is OK if labeled).
- Tapping a card opens the detail page (placeholder OK until task 10 lands).
- FAB visible above safe-area inset.

## Notes

- Use a Zustand slice or React Query for the booking range cache. Don't hand-roll caching.
- Avoid heavy calendar libraries (FullCalendar, etc.). A simple CSS-grid render keyed by minute math is enough.
