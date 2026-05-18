# 14 — Messaging integrations + reminder cron

Wire up confirmation/cancellation SMS in the API, and add the hourly reminder cron.

Depends on: **02** (`packages/messaging` already created with `ConsoleSmsProvider`), **08**, **10**.

## API messaging hooks

In the atomic booking transaction (task **08** / **10**):
- After successful create: insert a `Notification` row `(bookingId, type='confirmation', status='pending')`. Then, **outside** the transaction, call `smsProvider.sendSms(...)` and update the row to `sent` / `failed` with `sentAt`.

In the `PATCH /bookings/:id` cancel path (task **09** / **10**):
- Insert `Notification (type='cancellation', status='pending')`, send, update.

Idempotency: `@@unique([bookingId, type])` prevents duplicate inserts on retry.

## Cron app — `apps/cron/`

```
apps/cron/
├── package.json
├── index.ts            # handler dispatch (Lambda + local CLI entry)
└── reminders.ts        # find bookings 23–25h out, send reminder_24h
```

`reminders.ts` logic:
1. Compute `windowStart = now + 23h`, `windowEnd = now + 25h` (in business tz where the booking lives — be careful: convert from each tenant's tz).
2. Find `Booking` where `status='confirmed'` AND start datetime falls in that window AND no `Notification(bookingId, type='reminder_24h')` exists.
3. Send via `smsProvider.sendSms`. Upsert the `Notification` row.

The 1h reminder (`reminder_1h`) is part of the enum but **not implemented** in MVP — leave a TODO.

## Acceptance

- Creating a booking writes a `Notification(type='confirmation', status='sent')` row and logs the SMS to console.
- Cancelling a booking writes a `Notification(type='cancellation', status='sent')` row.
- Create a booking ~24h from now (use `prisma:studio` to backdate creation if needed). Run `pnpm tsx apps/cron/index.ts` once → `reminder_24h` row written + console log.
- Run the cron again → **no** duplicate row (uniqueness constraint).
- Tenant outside the 23–25h window is **not** touched.

## Notes

- Twilio / local AZ SMS provider integration is **post-MVP**. `ConsoleSmsProvider` is fine.
- CDK scheduling (EventBridge hourly) is out of scope. Local CLI invocation is enough to prove the logic.
