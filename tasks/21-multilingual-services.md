# 21 — Multilingual services (az/en/ru)

Let tenants enter a service name in each of the three supported locales (az, en, ru) so the storefront can render it in the visitor's language. The dashboard already runs in all three locales; this task extends that to **service content**, not just UI chrome.

Depends on: **05** (Services CRUD), **08** (storefront — to consume the localized name).

## Schema — `prisma/schema/services.prisma`

Replace the single `name String` column with three nullable per-locale columns:

```prisma
nameAz String? @map("name_az")
nameEn String? @map("name_en")
nameRu String? @map("name_ru")
```

Migration steps (single migration, no data loss):
1. Add the three new columns as nullable.
2. Backfill: `UPDATE services SET name_az = name` (default locale is az).
3. Drop the old `name` column.

At least one of the three must be non-null at the application layer (DTO validation). The DB keeps all three nullable so partial fills are allowed.

> If a tenant later wants more locales, we'd switch to a `service_translations` table — out of scope here. Three columns matches the current fixed locale set and keeps queries flat.

## DTO — `packages/dto/services.ts`

- Replace `name` field on `serviceCreateDto` / `serviceUpdateDto` with an object `name: { az?: string; en?: string; ru?: string }`.
- On create: require at least one non-empty value; trim and treat empty strings as `null`.
- On update: the partial shape allows updating one locale without touching the others.
- `serviceResponseDto`: expose all three (`nameAz`, `nameEn`, `nameRu`) plus a derived `name` resolved against the caller's locale (see "Resolution helper" below).

## Resolution helper — `packages/dto/utils.ts` (or new `packages/utils/i18n.ts`)

```ts
export type Locale = 'az' | 'en' | 'ru';
export const resolveLocalizedName = (
  s: { nameAz: string | null; nameEn: string | null; nameRu: string | null },
  locale: Locale,
  fallback: Locale = 'az',
): string => { ... }
```

Picks the requested locale, falls back to `fallback`, then to the first non-null. Used by both API responses and the storefront SSR/CSR layer.

## API — `apps/api/routes/services/`

- `GET /services` accepts `?locale=az|en|ru` (default `az` from tenant). Response items include the raw three fields **and** the resolved `name` so the dashboard can edit per-locale while still showing a single label.
- `POST` / `PATCH` accept the new shape; validate via the updated DTO.
- The storefront's public endpoint (task **08**'s `GET /public/:tenantSlug/services`) reads `locale` from the request (query or `Accept-Language` parsed against the supported set) and returns only the resolved `name`.

## Dashboard — `apps/dashboard/src/pages/services/`

- New + edit forms: replace the single name input with a **segmented control** (AZ / EN / RU) that swaps which language is being edited. Show a small badge on tabs that have content; empty tabs are allowed but at least one must be filled to save.
- List view: render `resolved name` for the current UI locale; if that locale is empty for a service, show the fallback in muted text so the tenant notices the gap.
- All UI strings for the new affordances go through `t()` and the JSON catalogs — no inline strings, including placeholder text like "Service name (Azerbaijani)".

## Storefront — `apps/storefront/`

- Resolves service names against the visitor's locale at fetch time (the API returns the already-resolved `name`); no additional client-side logic needed beyond passing the locale to the API.

## Acceptance

- Create a service from the dashboard with names in az + en only, save → DB has `name_az`, `name_en` filled, `name_ru` null.
- Switch dashboard language to en → list shows English names. Switch to ru → ru-empty services show their az fallback in muted style.
- Storefront in `/az/...` shows az names; `/en/...` shows en; `/ru/...` falls back to az for ru-empty services.
- Validation: submitting with all three empty rejects with a clear, translated error.
- Migration on a seed DB containing the old `name` column backfills cleanly and drops the legacy column.
- `pnpm typecheck && pnpm vitest && pnpm lint` clean across all packages.
