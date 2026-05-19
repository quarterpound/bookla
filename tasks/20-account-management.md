# 20 — Personal account management

Edit the **owner's own** profile (not the business) and provide a path to change their login phone or delete the account. Sister task to **13** (business profile) and **12** (staff): same Settings entry point, different scope.

This is **post-MVP**. Owners can run the entire MVP without ever needing to change their own name or phone; we ship without this and add it once the first user actually asks. But it's worth speccing now so the Settings tab has a planned home for it.

Depends on: **02** (OTP infra is reused for phone-change verification), **04** (auth UI patterns).

## What's in scope

| Surface | Scope |
|---|---|
| Edit profile | Name + avatar URL. No avatar upload — same MVP shortcut as task 13. |
| Change phone | Two-step OTP: enter new phone → enter code sent to new phone → swap `TenantUser.phone`. The current session's JWT stays valid (it keys off `userId`, not phone). |
| Delete account | Only allowed when the user owns a tenant with **no** bookings (or a pending-onboarding tenant). Otherwise return `ACCOUNT_DELETE_BLOCKED` with a "contact support" hint. Real GDPR/erasure handling is a separate, larger project. |
| Sessions / "sign out everywhere" | Out of scope. We don't have a refresh-token/jti store yet; deferring until we do. |

Social-provider linking (Google/Apple) lives in task **19**; the account page should host the UI for it once both ship.

## Database

No new tables. The `TenantUser` rows are already sufficient. The deletion path may end up cascading the owner's `Tenant` row (and its services, staff, etc.) — that's already wired via `onDelete: Cascade` from task 01.

## API — `apps/api/routes/account/`

- `GET /account` → `{ id, phone, name, avatarUrl, createdAt, lastLoginAt, role, subRole }`. (`/auth/me` returns user + tenant; `/account` is the **owner-scoped** view for the profile screen.)
- `PATCH /account` — body `accountUpdateDto`. Updates `name` and/or `avatarUrl`. Returns the new row.
- `POST /account/change-phone/send-otp` — body `{ newPhone }`. Rejects if `newPhone == current phone` (`SAME_PHONE`) or if another `TenantUser` already owns it (`PHONE_TAKEN`). Otherwise creates an `OtpChallenge` keyed by `newPhone`. Reuses task 02's rate-limit + bcrypt hashing. Logs the code through `getSmsProvider()`.
- `POST /account/change-phone/verify` — body `{ newPhone, code }`. Same verify path as the login flow (5-attempt cap, dev `000000` bypass when `NODE_ENV !== 'production'`). On success: update `TenantUser.phone = newPhone`, mark the challenge `consumedAt`, set `lastLoginAt`. Return the updated user row. Do **not** re-issue the JWT — phone isn't part of the payload.
- `DELETE /account` — preflight:
  - If the user is the **only** owner of a Tenant AND the Tenant has at least one Booking → `409 ACCOUNT_DELETE_BLOCKED`.
  - Otherwise transactional cascade: delete the `TenantUser`; if they were the last owner of their Tenant, delete the Tenant (the FK cascades wipe `Staff`, `Service`, `Client`, etc.).
  - On success: clear the auth cookie in the response (same path/domain settings as `/auth/logout`) and return `{ deleted: true }`.

All four routes use `authMiddleware`. Phone-change endpoints don't need extra auth beyond "you're logged in" — the OTP to the new phone is the second factor.

## DTOs — `packages/dto/account.ts`

```ts
accountResponseDto = z.object({
  id, phone, name (nullable), avatarUrl (nullable),
  role, subRole, createdAt, lastLoginAt (nullable)
})

accountUpdateDto = z.object({
  name:      z.string().trim().min(1).max(80).optional(),
  avatarUrl: z.string().url().nullable().optional(),
})

changePhoneSendOtpDto = z.object({ newPhone: phoneValidator })
changePhoneVerifyDto  = z.object({ newPhone: phoneValidator, code: z.string().regex(/^\d{6}$/) })
```

Re-export from `packages/dto/index.ts` + add the path to `packages/dto/package.json` exports.

## Dashboard — `apps/dashboard/`

**Files to create:**
- `apps/dashboard/src/api/account.ts` — `getAccount`, `updateAccount`, `sendChangePhoneOtp`, `verifyChangePhone`, `deleteAccount`.
- `apps/dashboard/src/pages/settings/account/index.tsx` — main account screen. Sections: avatar + name (inline edit, "Save" appears when dirty); phone (read-only with "Change" button → push to `/settings/account/change-phone`); danger zone with a confirm-twice "Delete account" button.
- `apps/dashboard/src/pages/settings/account/change-phone.tsx` — two-step pushed route (new phone → code), same pattern as login. On success: invalidate the auth-store user, navigate back, show a toast.

**Files to modify:**
- `apps/dashboard/src/pages/tabs/settings.tsx` — add an "Account" row above "Services" pushing to `/settings/account`.
- `apps/dashboard/src/router.tsx` — register the two new pushed routes under `ProtectedRoute`.
- `apps/dashboard/src/store/auth.store.ts` — no new fields; just make sure the store updates the local user record after `updateAccount` and `verifyChangePhone` so the Settings card stays in sync without a full refetch.

**Confirm-twice delete:** open a `Sheet` that requires the user to type the literal word from the i18n catalog (`account.delete.confirmWord`, e.g. "DELETE" in en, "SİL" in az, "УДАЛИТЬ" in ru). Only then enable the destructive button. Standard pattern that prevents fat-finger deletions on a phone.

## i18n keys — three locales

- `account.title`, `account.fields.name`, `account.fields.avatar`, `account.save`, `account.saving`
- `account.phone.current`, `account.phone.change`, `account.phone.newLabel`, `account.phone.sentTo`, `account.phone.verifyTitle`, errors
- `account.delete.title`, `account.delete.description`, `account.delete.confirmWord`, `account.delete.confirmHint`, `account.delete.confirmButton`, `account.delete.blockedTitle`, `account.delete.blockedDescription`
- `settings.rows.account.label`, `settings.rows.account.hint`

No inline strings — i18n catalogs from the first commit.

## Acceptance

- Editing `name` from the Account page persists across reload and reflects in `/settings` (the read-only Settings card).
- Changing phone with code `000000` (dev) succeeds; logging back out and signing in with the new phone works; old phone gets a fresh OTP but the user record no longer matches.
- Attempting to change to a phone owned by another `TenantUser` returns `400 PHONE_TAKEN`; the UI shows that inline.
- Deleting an account that owns a tenant with no bookings: succeeds, cookie cleared, dashboard bounces to `/auth/login`; row gone from `prisma:studio`; cascade removes the Tenant + its empty Staff/Service/WorkingHours rows.
- Deleting an account with existing bookings: returns `409 ACCOUNT_DELETE_BLOCKED`; the UI shows the "contact support" message without navigating away.
- `pnpm typecheck` clean.

## Notes

- **Why phone-change is OTP-gated to the new number, not the current one:** the threat we're protecting against is "attacker stole your session and wants to lock you out by swapping the recovery phone". Verifying the new phone proves the user actually has the new device. Verifying the old phone would just confirm the session is still hot — which we already know because they're logged in.
- **Why `lastLoginAt` is bumped on phone change:** the OTP they just verified is functionally a re-login event. Keeps audit timestamps honest.
- Avatar upload (S3 + signed URL) deferred to the same future task that handles business-avatar uploads in task 13. For MVP, both screens accept a URL field.
- If/when task **19** ships, this screen also hosts "Connected accounts" — but that section's API and DTOs live with 19. This task only stubs the row layout so 19 can drop in cleanly.
