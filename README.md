# Bookla

Multi-tenant booking application — scaffold.

## Stack

- **API** (`apps/api`): Hono on Node / AWS Lambda, Prisma over Postgres, cookie-based JWT auth.
- **Dashboard** (`apps/dashboard`): React 19 + Vite + React Router + Zustand + TanStack Query.
- **Shared packages**: `@bookla/db` (Prisma client factory), `@bookla/dto` (Zod schemas + types), `@bookla/utils` (secrets helpers).

## Multi-tenancy model

- Every row that belongs to a customer is scoped by `tenantId`.
- `TenantUser.email` is unique *per tenant* (`@@unique([tenantId, email])`), so the same email may exist in multiple workspaces.
- Auth flow:
  1. `POST /auth/register` creates a new `Tenant` + an `owner` `TenantUser` and issues a JWT in an HTTP-only cookie.
  2. `POST /auth/login` accepts `{ email, password, tenantSlug? }`. If the email is in more than one tenant, `tenantSlug` is required.
  3. `authMiddleware` decodes the cookie, loads the user, and puts `{ userId, tenantId, role, subRole }` on `c.get('user')`.
  4. Every service query filters by `user.tenantId`. `requireTenant(':tenantId')` additionally guards URL-bound tenant params.

## First-time setup

```bash
pnpm install
cp .env.example .env          # edit DATABASE_URL + JWT_SECRET

pnpm prisma:generate
pnpm prisma:migrate           # creates the initial migration
pnpm prisma:seed              # creates tenant "acme" with owner@acme.test / password123
# Connection URL + adapter live in /prisma.config.ts (Prisma 7+)
```

## Run

```bash
pnpm dev:api          # http://localhost:4200
pnpm dev:dashboard    # http://localhost:5173
```

## Endpoints

| Method | Path                         | Auth         | Body / Notes |
|--------|------------------------------|--------------|--------------|
| GET    | `/health`                    | none         | DB ping      |
| POST   | `/auth/register`             | none         | `{ tenantName, tenantSlug, email, password, name? }` |
| POST   | `/auth/login`                | none         | `{ email, password, tenantSlug? }` |
| POST   | `/auth/logout`               | none         | clears cookie |
| GET    | `/auth/me`                   | cookie       | current user + tenant |
| GET    | `/tenants/current`           | cookie       | current tenant |
| GET    | `/tenants/current/members`   | manager+     | list of tenant members |
