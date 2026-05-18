# Project Structure & Coding Style Guide

This document describes the architecture, patterns, and conventions used in this monorepo. Use it as a blueprint when building a new application with the same structure.

---

## 1. Monorepo Layout

```
/
├── apps/                  # All applications (backend + frontend)
│   ├── api/               # Main REST API (Hono + Lambda)
│   ├── cron/              # Scheduled tasks (Lambda + EventBridge)
│   ├── webhooks/          # Inbound webhook handler (Lambda + API GW)
│   ├── stripe-events/     # Stripe event processor (Lambda)
│   ├── order-events/      # Async event processor (Lambda + SQS)
│   ├── reports/           # Report generation (Lambda)
│   ├── feeds/             # Feed generation (Lambda)
│   ├── notifications/     # Notification service (Lambda)
│   ├── backfill/          # Data backfill jobs (AWS Batch)
│   ├── cloudwatch-alarms/ # Alarm handlers (Lambda)
│   ├── third-party/       # Partner API endpoints (Lambda)
│   ├── dashboard/         # Manager dashboard (React + Vite)
│   ├── admin/             # Internal admin panel (React + Vite)
│   ├── kitchen/           # Kitchen display (React + Vite)
│   ├── store/             # Store mgmt + storefront (React + Vite)
│   └── pos/               # Point of sale (React + Vite)
├── packages/              # Shared libraries
│   ├── db/                # Prisma client factory
│   ├── dto/               # Zod schemas (shared contracts)
│   ├── types/             # Shared TypeScript types
│   ├── utils/             # Helpers (secrets, currency, etc.)
│   ├── messaging/         # SMS client wrapper
│   ├── payments/          # Payment processing utils
│   ├── metrics/           # CloudWatch metrics wrapper
│   ├── slack-events/      # Slack bot handlers
│   ├── data/              # Data access utilities
│   ├── printer/           # ESC-POS receipt encoding
│   └── web/               # Shared React UI components (shadcn/ui)
├── infra/                 # AWS CDK infrastructure (one stack per concern)
├── prisma/                # Database schema (split across multiple .prisma files)
├── package.json           # Workspace root
└── tsconfig.json          # Root TypeScript config with path aliases
```

### Workspace Configuration

**Root `package.json`:**
```json
{
  "workspaces": ["packages/*", "apps/*", "infra"]
}
```

All dependencies are hoisted to the root `node_modules/`. Individual apps and packages have their own `package.json` for app-specific deps and scripts.

### TypeScript Path Aliases

Defined in root `tsconfig.json`, these allow cross-workspace imports:
```json
{
  "paths": {
    "@api/*":          ["./apps/api/*"],
    "@dto/*":          ["./packages/dto/*"],
    "@db/*":           ["./packages/db/*"],
    "@utils/*":        ["./packages/utils/*"],
    "@messaging/*":    ["./packages/messaging/*"],
    "@web/*":          ["./packages/web/*"],
    "@data/*":         ["./packages/data/*"],
    "@payments/*":     ["./packages/payments/*"],
    "@metrics/*":      ["./packages/metrics/*"],
    "@types/*":        ["./packages/types/*"],
    "@printer/*":      ["./packages/printer/*"]
  }
}
```

### Root TypeScript Settings

```json
{
  "compilerOptions": {
    "module": "nodenext",
    "target": "esnext",
    "strict": true,
    "strictNullChecks": true,
    "noUncheckedIndexedAccess": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "skipLibCheck": true
  }
}
```

---

## 2. Backend API Pattern (Hono + Lambda)

### Entry Point (`apps/api/index.ts`)

The main API uses **Hono** as the web framework, running both locally (via `@hono/node-server`) and on AWS Lambda (via `hono/aws-lambda`).

```typescript
import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { handle } from 'hono/aws-lambda'
import { cors } from 'hono/cors'
import { env } from './env'

// Create Hono app
export const app = new Hono()

  // 1. Global middleware
  .use('*', cors({
    origin: (origin) => {
      if (allowedOrigins.includes(origin)) return origin;
      return null;
    },
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    credentials: true,
  }))
  .use('*', metricsMiddleware)

  // 2. Health check
  .get('/health', async (c) => {
    const prisma = await getPrismaClient();
    await prisma.$queryRaw`SELECT 1`;
    return c.json({ status: 'healthy', timestamp: new Date().toISOString() });
  })

  // 3. Global error handler
  .onError((err, c) => {
    if (err instanceof AppError) {
      return c.json({ error: err.message, type: 'app-error' }, err.status ?? 500);
    }
    if (err instanceof HTTPException) {
      return c.json({ error: err.message, type: 'http-error' }, err.status);
    }
    return c.json({ error: 'Internal server error', type: 'unhandled' }, 500);
  })

  // 4. Mount route controllers
  .route('/auth', authController)
  .route('/orders', ordersController)
  .route('/products', productsController)
  // ... more routes

// Lambda handler export
export const handler = handle(app);

// Local dev server
if (env.NODE_ENV === 'development') {
  serve({ fetch: app.fetch, port: 4200 });
}
```

### Environment Validation (`apps/api/env.ts`)

All environment variables are validated at startup using Zod with conditional requirements for prod vs dev:

```typescript
import { z } from 'zod'
import dotenv from 'dotenv'

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production']).default('development'),
  DATABASE_URL: z.string().optional(),
  DATABASE_SECRET_ARN: z.string().optional(),
  DATABASE_PROXY_ENDPOINT: z.string().optional(),
  JWT_SECRET: z.string().optional(),
  JWT_SECRET_ARN: z.string().optional(),
  AWS_REGION: z.string().default('us-east-2'),
  PUBLIC_ASSETS_BUCKET: z.string(),
  CLOUDFRONT_URL: z.string(),
  // ... more env vars
}).refine((env) => {
  if (env.NODE_ENV === 'production') {
    return env.DATABASE_SECRET_ARN && env.JWT_SECRET_ARN;
  }
  return (env.DATABASE_URL || env.DATABASE_SECRET_ARN) && (env.JWT_SECRET || env.JWT_SECRET_ARN);
}, {
  message: 'In production: ARNs required. In dev: provide ARNs or local values.'
});

export const env = envSchema.parse(process.env);
```

### Controller Pattern (`apps/api/routes/{feature}/{feature}.controller.ts`)

Controllers are Hono instances that define routes. They handle:
- Input validation via `zValidator`
- Authentication via middleware
- Delegating to service functions
- Returning JSON responses

```typescript
import { authMiddleware, requireRole } from "@api/middleware/auth.middleware";
import { filterOrdersDto, refundRequestDto } from "@dto/orders";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { getOrders, getSingleOrder, refundOrder } from "./orders.service";
import z from "zod";
import { subscriptionGuard } from "@api/middleware/subscription.middleware";

export const ordersController = new Hono()
  .use(subscriptionGuard)  // Applied to all routes in this controller

  .get('/',
    zValidator('query', filterOrdersDto),  // Validate query params
    authMiddleware,                         // Require authenticated user
    async (c) => {
      const user = c.get('user');
      const orders = await getOrders(user, c.req.valid('query'));
      return c.json(orders);
    }
  )

  .get('/:id',
    zValidator('param', z.object({ id: z.coerce.number() })),
    authMiddleware,
    async (c) => {
      const user = c.get('user');
      const order = await getSingleOrder(user, c.req.valid('param').id);
      return c.json(order);
    }
  )

  .post('/:id/refund',
    zValidator('param', z.object({ id: z.coerce.number() })),
    zValidator('json', refundRequestDto),
    requireRole('admin'),  // Role-based access
    async (c) => {
      const user = c.get('user');
      const order = await refundOrder(c.req.valid('param').id, c.req.valid('json'), user);
      return c.json(order);
    }
  )
```

### Service Pattern (`apps/api/routes/{feature}/{feature}.service.ts`)

Services contain business logic. They:
- Get the Prisma client
- Query the database with tenant isolation
- Throw `AppError` or `HTTPException` for error cases
- Return typed responses

```typescript
import { getPrismaClient } from "@api/db";
import { AuthUser } from "@api/middleware/auth.middleware";
import { AppError } from "@api/utils/errors";
import { FilterOrdersDto, OrdersResponseDto } from "@dto/orders";
import { HTTPException } from "hono/http-exception";

export const getSingleOrder = async (user: AuthUser, id: number): Promise<OrdersResponseDto> => {
  const db = await getPrismaClient();
  const order = await db.order.findUnique({
    where: {
      id,
      tenantId: user.tenantId,  // Always filter by tenant
    },
    include: {
      items: {
        include: {
          product: true,
          productVariant: true,
          orderItemTaxes: true,
        },
      },
      customer: true,
      lane: { omit: { qrCodeSettings: true } },
    },
  });

  if (!order) {
    throw new HTTPException(404, { message: 'Order not found' });
  }
  return order;
};

export const getOrders = async (user: AuthUser, filter: FilterOrdersDto) => {
  const db = await getPrismaClient();
  // ... paginated query with filters
};
```

### Error Handling (`apps/api/utils/errors.ts`)

```typescript
import { ContentfulStatusCode } from "hono/utils/http-status";

export class AppError extends Error {
  constructor(message: string, public code?: string, public status?: ContentfulStatusCode) {
    super(message);
    this.name = 'AppError';
  }
}
```

Usage: `throw new AppError('Email already exists', 'EMAIL_EXISTS', 400);`

### Middleware Pattern (`apps/api/middleware/`)

Middleware follows Hono's `(c: Context, next: Next)` signature. Auth middleware extracts JWT from cookies, verifies it, fetches the user from DB, and sets context variables.

```typescript
import type { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { getCookie } from 'hono/cookie';

// Extend Hono's context with typed variables
declare module 'hono' {
  interface ContextVariableMap {
    user: AuthUser;
    adminUser: JwtAdminPayload;
    customer: CustomerJwtPayload | undefined | null;
  }
}

export const authMiddleware = async (c: Context, next: Next) => {
  const token = getCookie(c, 'token');
  if (!token) throw new HTTPException(401, { message: 'Authentication token missing' });

  const payload = await verifyToken(token);
  const db = await getPrismaClient();
  const user = await db.tenantUser.findUnique({ where: { id: payload.userId } });
  if (!user) throw new HTTPException(401, { message: 'User not found' });

  c.set('user', { ...payload, tenantId: user.tenantId!, role: user.role });
  await next();
};

// Role-based middleware factory
export const requireRole = (...allowedRoles: UserSubRole[]) => {
  return async (c: Context, next: Next) => {
    let user = c.get('user');
    if (!user) {
      await authMiddleware(c, async () => {});
      user = c.get('user');
    }
    // Owners and admins always pass
    if (user.role === UserRole.owner || user.subRole === UserSubRole.admin) {
      await next();
      return;
    }
    if (!allowedRoles.includes(user.subRole)) {
      throw new HTTPException(403, { message: 'Insufficient permissions' });
    }
    await next();
  };
};

// Tenant isolation middleware
export const requireTenant = (tenantIdParam: string = 'tenantId') => {
  return async (c: Context, next: Next) => {
    // ... validates that the requested tenant matches the user's tenant
  };
};
```

### Backend Build Process

Each backend app's `package.json`:
```json
{
  "scripts": {
    "dev": "tsx watch index.ts",
    "build": "tsc --noEmit && esbuild index.ts --bundle --outdir=dist --platform=node --target=node20 --sourcemap && npm run copy-query-engine",
    "copy-query-engine": "mkdir -p dist/node_modules/.prisma/client && cp ../../node_modules/.prisma/client/query_compiler_bg.wasm dist/node_modules/.prisma/client/"
  }
}
```

Key points:
- `tsc --noEmit` for type checking only (esbuild handles bundling)
- `esbuild` bundles to a single file targeting Node.js 20
- Prisma query compiler WASM must be copied to dist for Lambda

---

## 3. Shared Packages

### `packages/db/` - Database Client

Singleton Prisma client with async initialization. Uses `PrismaPg` adapter for Lambda environments. Supports both direct `DATABASE_URL` (dev) and `DATABASE_SECRET_ARN` (prod via Secrets Manager + RDS Proxy).

```typescript
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { buildDatabaseUrl, getDatabaseCredentialsByArn } from '@utils/secrets'

export type CustomPrismaClient = ReturnType<typeof getClient>
export type CustomPrismaTx = Parameters<Parameters<CustomPrismaClient['$transaction']>[0]>[0]

const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof getClient> }
let initPromise: Promise<ReturnType<typeof getClient>> | null = null

export const getPrismaClient = async (): Promise<ReturnType<typeof getClient>> => {
  if (globalForPrisma.prisma) return globalForPrisma.prisma
  if (initPromise) return initPromise

  initPromise = (async () => {
    let databaseUrl = process.env.DATABASE_URL
    if (process.env.DATABASE_SECRET_ARN) {
      const creds = await getDatabaseCredentialsByArn(process.env.DATABASE_SECRET_ARN)
      databaseUrl = buildDatabaseUrl(creds, process.env.DATABASE_PROXY_ENDPOINT)
    }
    const adapter = new PrismaPg({ connectionString: databaseUrl })
    const client = getClient(adapter)
    globalForPrisma.prisma = client
    return client
  })()

  return initPromise
}

function getClient(adapter: PrismaPg) {
  return new PrismaClient({ adapter }).$extends({
    result: {
      // Add computed fields to models here
      order: {
        grandTotal: {
          compute: (data) => {
            // Computed from subtotal, tax, tip, discounts, etc.
          },
        },
      }
    }
  })
}
```

### `packages/dto/` - Data Transfer Objects

Zod schemas shared between frontend and backend. Each domain has its own file. Common utilities in `utils.ts`:

```typescript
// packages/dto/utils.ts
import z from "zod";

// Reusable pagination schema
export const paginationDto = z.object({
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(50),
});

export const paginatedSearch = paginationDto.extend({
  search: z.string().optional(),
});

// Standard paginated response type
export type PaginationResponse<T> = {
  data: T[];
  count: number;
  filteredCount: number;
};

// Common validators
export const passwordValidator = z.string().min(8, 'Password must be at least 8 characters long');
export const phoneNumberValidator = z.string().transform(/* normalize */).refine(/* validate */);
export const idValidator = z.object({ id: z.coerce.number() });

// Helper to convert empty string to undefined
export const emptyStringToUndefined = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((val) => (typeof val === "string" && val.trim() === "" ? undefined : val), schema);
```

**DTO file pattern** (`packages/dto/orders.ts`):
```typescript
import { z } from "zod";
import { paginationDto } from "./utils";
import type { Prisma } from "@prisma/client";

// Request DTOs (Zod schemas for validation)
export const filterOrdersDto = paginationDto.extend({
  status: filterOrderStatusSchema.optional(),
  customerId: z.coerce.number().optional(),
  createdAtMin: z.coerce.date().optional(),
  createdAtMax: z.coerce.date().optional(),
});

export const refundRequestDto = z.object({
  note: z.string(),
});

// Infer TypeScript types from Zod schemas
export type FilterOrdersDto = z.infer<typeof filterOrdersDto>;
export type RefundRequestDto = z.infer<typeof refundRequestDto>;

// Response types use Prisma payload types for full type safety
export type OrdersResponseDto = Prisma.OrderGetPayload<{
  include: {
    items: { include: { product: true, productVariant: true } },
    customer: true,
    lane: { omit: { qrCodeSettings: true } },
  }
}> & { grandTotal: number };
```

### `packages/utils/secrets.ts` - AWS Secrets Manager

Caches secrets in memory to avoid repeated API calls within the same Lambda invocation:

```typescript
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const secretsManager = new SecretsManagerClient({});
export const secretCache = new Map<string, string>();

export const fetchSecretByArn = async (secretArn: string) => {
  if (secretCache.has(secretArn)) return secretCache.get(secretArn)!;
  if (process.env.NODE_ENV === 'development') return secretArn; // Use ARN value directly in dev

  const secret = await secretsManager.send(new GetSecretValueCommand({ SecretId: secretArn }));
  secretCache.set(secretArn, secret.SecretString!);
  return secret.SecretString!;
};

export const getDatabaseCredentialsByArn = async (secretArn: string): Promise<DatabaseCredentials> => {
  const secret = await fetchSecretByArn(secretArn);
  return JSON.parse(secret) as DatabaseCredentials;
};

export const buildDatabaseUrl = (creds: DatabaseCredentials, proxyEndpoint?: string): string => {
  const host = proxyEndpoint || creds.host;
  return `postgresql://${creds.username}:${creds.password}@${host}:${creds.port}/${creds.dbname}?sslmode=no-verify&schema=public`;
};
```

---

## 4. Database (Prisma)

### Schema Organization

The Prisma schema is split across multiple `.prisma` files in `/prisma/`:

```
prisma/
├── schema.prisma    # Generator config, datasource, main settings
├── enums.prisma     # All enumerations
├── helper.prisma    # Utility models (Asset, Settings, etc.)
├── tenants.prisma   # Tenant, TenantUser, TenantLocation
├── orders.prisma    # Order, OrderItem, Payment
├── catalog.prisma   # Product, Category, ProductVariant
├── customers.prisma # Customer, CustomerLoyalty
├── billing.prisma   # Subscription, Credits
├── discounts.prisma # Discount, Coupon, Promotion
├── loyalty.prisma   # Loyalty program models
├── messages.prisma  # Message templates
├── oauth.prisma     # OAuth clients, tokens
├── feeds.prisma     # Feed configuration
├── refunds.prisma   # Refund models
├── rentals.prisma   # Rental items
├── webhooks.prisma  # Webhook endpoints
└── seed.ts          # Database seeding
```

### Schema Config (`prisma/schema.prisma`)
```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["queryCompiler", "driverAdapters"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Key: `queryCompiler` + `driverAdapters` preview features are required for Lambda compatibility with `PrismaPg` adapter.

### Database Operations Pattern

```typescript
// Simple query with tenant isolation
const db = await getPrismaClient();
const order = await db.order.findUnique({
  where: { id, tenantId: user.tenantId },
  include: { items: true, customer: true },
});

// Transactions
const result = await db.$transaction(async (tx) => {
  const tenant = await tx.tenant.create({ data: { ... } });
  const user = await tx.tenantUser.create({ data: { tenantId: tenant.id, ... } });
  return { tenant, user };
});

// Pagination pattern
const [data, filteredCount, count] = await Promise.all([
  db.order.findMany({
    where: filters,
    skip: (page - 1) * limit,
    take: limit,
    orderBy: { createdAt: 'desc' },
    include: { ... },
  }),
  db.order.count({ where: filters }),
  db.order.count({ where: { tenantId: user.tenantId } }),
]);
return { data, filteredCount, count };
```

---

## 5. Frontend Application Pattern (React + Vite)

### Frontend Build & Dependencies

**`package.json` (per frontend app):**
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build"
  }
}
```

**Core frontend stack:**
- React 19 + React Router 7
- Vite 7 (build tool)
- TailwindCSS 4 (styling)
- Radix UI / shadcn/ui (components, from `packages/web/`)
- React Hook Form + Zod (forms)
- TanStack React Query (data fetching)
- Zustand (state management)
- Axios + Hono RPC client (API calls)

### App Entry (`main.tsx` + `App.tsx`)

```tsx
// main.tsx
createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>
);

// App.tsx
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      if (error instanceof ClientError) toast.error(error.message);
    }
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      if (error instanceof ClientError) toast.error(error.message);
    }
  })
});
```

### Routing (`router.tsx`)

Lazy-loaded pages with auth guards:

```tsx
const OrdersPage = lazy(() => import("./pages/orders"));
const ProductsPage = lazy(() => import("./pages/products"));

export const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      {
        path: '/auth',
        element: <AuthRoute />,  // Redirect if already logged in
        children: [
          { path: 'login', element: <LoginPage /> },
          { path: 'register', element: <RegisterPage /> },
        ]
      },
      {
        element: <ProtectedRoute />,  // Redirect to login if not auth'd
        children: [
          { path: '/', element: <HomePage /> },
          { path: '/orders', element: <OrdersPage /> },
          { path: '/orders/:id', element: <SingleOrderPage /> },
          { path: '/products', element: <ProductsPage /> },
        ]
      }
    ]
  }
]);

const Root = () => (
  <ThemeProvider>
    <TooltipProvider>
      <Suspense fallback={null}><Outlet /></Suspense>
      <Toaster />
    </TooltipProvider>
  </ThemeProvider>
);
```

### API Client (`api/base.ts`)

```typescript
export class ClientError extends Error {
  constructor(message: string, public status?: number, public apiError?: unknown) {
    super(message);
  }
}

export const baseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:4200';

// Axios instance for REST calls
export const baseService = axios.create({
  baseURL: baseUrl,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,  // Send cookies
});

baseService.interceptors.response.use(
  response => response,
  error => {
    if (axios.isAxiosError(error)) {
      return Promise.reject(new ClientError(error.message, error.status, error.response?.data));
    }
    return Promise.reject(error);
  }
);
```

**API function pattern** (`api/orders.ts`):
```typescript
export const getOrders = async (filters: FilterOrdersDto) => {
  const response = await baseService.get<PaginationResponse<OrdersResponseDto>>(
    '/orders', { params: filters }
  );
  return response.data;
};
```

### Page Pattern (`pages/{feature}/index.tsx`)

```tsx
const OrdersPage = () => {
  const { pagination, setPage } = usePagination();
  const [filters, setFilters] = useState<Partial<FilterOrdersDto>>({});

  const query = useQuery({
    queryKey: ['orders', pagination.page, pagination.limit, filters],
    queryFn: () => getOrders({ page: pagination.page, limit: pagination.limit, ...filters }),
  });

  return (
    <MainLayout breadcrumb={[{ label: "Orders" }]} title="Orders">
      <DashboardInner className="grid gap-6">
        <PageHeader>
          <PageTitle>Orders</PageTitle>
          <PageDescription>Manage your orders</PageDescription>
        </PageHeader>
        <OrdersTable
          data={query.data}
          isLoading={query.isLoading}
          pagination={pagination}
          handlePageChange={setPage}
          handleFilterChange={setFilters}
        />
      </DashboardInner>
    </MainLayout>
  );
};
```

### State Management (Zustand)

```typescript
const useAuthStore = create((set) => ({
  tenant: null,
  user: null,
  loading: true,
  setAuth: (tenant, user, loading) => set({ tenant, user, loading }),
  logout: () => set({ tenant: null, user: null, loading: false }),
}));
```

### Frontend Directory Structure

```
apps/{frontend-app}/
├── src/
│   ├── api/            # API client functions (one file per domain)
│   ├── components/     # Reusable React components
│   ├── pages/          # Route page components (lazy loaded)
│   │   ├── home/
│   │   ├── orders/
│   │   │   ├── index.tsx
│   │   │   └── single-order.tsx
│   │   └── products/
│   ├── hooks/          # Custom React hooks
│   ├── store/          # Zustand stores
│   ├── contexts/       # React contexts
│   ├── lib/            # Utilities (formatting, constants)
│   ├── types/          # TypeScript types
│   ├── App.tsx
│   ├── main.tsx
│   ├── router.tsx
│   └── index.css       # Tailwind imports
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

## 6. CDK Infrastructure

### Stack Organization

Each concern gets its own CDK stack. The main entry point (`infra/index.ts`) creates all stacks and wires dependencies.

**Infrastructure config (`infra/tsconfig.json`):**
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "strict": true,
    "declaration": true
  }
}
```

**Stack naming convention:** `{AppName}-{StackName}-{stage}`
Example: `Ezlanes-ApiStack-prod`

### CDK Entry Point (`infra/index.ts`)

```typescript
import * as cdk from 'aws-cdk-lib';

export type Stage = 'prod' | 'staging';

const stage: Stage = 'prod';
const account = '123456789012';
const region = 'us-east-2';
const domainName = 'example.com';

const app = new cdk.App({ context: { account, region } });

// Foundation stacks (no dependencies)
const vpcStack = new VpcStack(app, `App-VpcStack-${stage}`, { stage, env: { account, region } });
const secretsStack = new SecretsStack(app, `App-SecretsStack-${stage}`, { stage, env: { account, region } });
const storageStack = new StorageStack(app, `App-StorageStack-${stage}`, { stage, env: { account, region } });
const dnsStack = new DnsStack(app, `App-DnsStack-${stage}`, { stage, domainName, env: { account, region } });

// Dependent stacks (receive props from foundation stacks)
const rdsStack = new RdsStack(app, `App-RdsStack-${stage}`, {
  stage,
  vpc: vpcStack.vpc,
  databaseCredentialsSecretArn: secretsStack.databaseCredentials.secretArn,
  env: { account, region },
});

const apiStack = new ApiStack(app, `App-ApiStack-${stage}`, {
  stage, domainName,
  vpc: vpcStack.vpc,
  databaseProxy: rdsStack.proxy,
  databaseSecret: secretsStack.databaseCredentials,
  jwtSecret: secretsStack.jwtSecret,
  publicAssetsBucket: storageStack.publicAssetsBucket,
  // ... more props
  env: { account, region },
});

// Frontend stacks (us-east-1 for CloudFront)
const frontendStack = new FrontendStack(app, `App-FrontendStack-${stage}`, {
  stage, domainName,
  hostedZone: dnsStack.hostedZone,
  env: { account, region: 'us-east-1' },  // CloudFront requires us-east-1
});
```

### API Lambda Stack Pattern (`infra/api.ts`)

```typescript
export interface ApiStackProps extends cdk.StackProps {
  stage: Stage;
  domainName: string;
  hostedZone: route53.IHostedZone;
  certificate: acm.ICertificate;
  vpc: ec2.IVpc;
  databaseSecret: secretsmanager.ISecret;
  databaseProxy: rds.DatabaseProxy;
  jwtSecret: secretsmanager.ISecret;
  publicAssetsBucket: Bucket;
  privateAssetsBucket: Bucket;
  // ... more props
}

export class ApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    // 1. Lambda function
    const apiLambda = new lambda.Function(this, 'ApiLambda', {
      functionName: `${props.stage}-appname-api`,
      runtime: lambda.Runtime.NODEJS_LATEST,
      handler: 'index.handler',
      architecture: lambda.Architecture.ARM_64,
      code: lambda.Code.fromAsset(path.join(__dirname, '..', 'apps', 'api', 'dist')),
      timeout: cdk.Duration.seconds(30),
      memorySize: 1024,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS, onePerAz: true },
      environment: {
        NODE_ENV: 'production',
        DATABASE_SECRET_ARN: props.databaseSecret.secretArn,
        DATABASE_PROXY_ENDPOINT: props.databaseProxy.endpoint,
        JWT_SECRET_ARN: props.jwtSecret.secretArn,
        PUBLIC_ASSETS_BUCKET: props.publicAssetsBucket.bucketName,
        // ... more env vars
      }
    });

    // 2. IAM permissions (grant-based where possible)
    props.databaseSecret.grantRead(apiLambda);
    props.jwtSecret.grantRead(apiLambda);
    props.publicAssetsBucket.grantReadWrite(apiLambda);

    // 3. Explicit IAM for services without grant helpers
    apiLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['s3:PutObject', 's3:GetObject', 's3:DeleteObject'],
      resources: [`${props.publicAssetsBucket.bucketArn}/*`],
    }));

    // 4. API Gateway (REST, proxy to Lambda)
    const api = new apigateway.RestApi(this, 'AppApi', {
      restApiName: `${props.stage}-appname-api`,
      deployOptions: { stageName: props.stage, throttlingRateLimit: 500, throttlingBurstLimit: 1000 },
      defaultCorsPreflightOptions: { /* ... */ },
    });

    // 5. Lambda alias with provisioned concurrency + auto-scaling
    const live = apiLambda.currentVersion.addAlias('live', { provisionedConcurrentExecutions: 3 });
    const scaling = live.addAutoScaling({ minCapacity: 3, maxCapacity: 200 });
    scaling.scaleOnUtilization({ utilizationTarget: 0.85 });

    // 6. Proxy integration (all routes -> Lambda)
    api.root.addProxy({
      defaultIntegration: new apigateway.LambdaIntegration(live, { proxy: true }),
      anyMethod: true,
    });

    // 7. Custom domain + Route53 record
    const domainName = new apigateway.DomainName(this, 'ApiDomainName', {
      domainName: `api.${props.domainName}`,
      certificate: props.certificate,
      endpointType: apigateway.EndpointType.REGIONAL,
    });
    domainName.addBasePathMapping(api);

    new route53.ARecord(this, 'ApiAliasRecord', {
      zone: props.hostedZone,
      recordName: `api.${props.domainName}`,
      target: route53.RecordTarget.fromAlias(new route53targets.ApiGatewayDomain(domainName)),
    });
  }
}
```

### Frontend Stack Pattern (`infra/frontend.ts`)

```typescript
export class FrontendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: FrontendStackProps) {
    super(scope, id, props);

    // 1. S3 bucket (private, no public access)
    const bucket = new s3.Bucket(this, 'FrontendBucket', {
      bucketName: `${stage}-appname-frontend-${domainName.replace('.', '-')}`,
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'index.html',
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // 2. ACM certificate (must be in us-east-1 for CloudFront)
    const certificate = new acm.Certificate(this, 'Certificate', {
      domainName: `app.${domainName}`,
      validation: acm.CertificateValidation.fromDns(hostedZone),
    });

    // 3. CloudFront distribution with OAC
    const oac = new cloudfront.S3OriginAccessControl(this, 'OAC');
    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      domainNames: [`app.${domainName}`],
      certificate,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(bucket, { originAccessControl: oac }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        compress: true,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      defaultRootObject: 'index.html',
      // SPA routing: return index.html for 403/404
      errorResponses: [
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html' },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html' },
      ],
    });

    // 4. Bucket policy for CloudFront OAC
    bucket.addToResourcePolicy(new iam.PolicyStatement({
      principals: [new iam.ServicePrincipal('cloudfront.amazonaws.com')],
      actions: ['s3:GetObject'],
      resources: [bucket.arnForObjects('*')],
      conditions: { StringEquals: { 'AWS:SourceArn': distribution.distributionArn } },
    }));

    // 5. DNS record
    new route53.ARecord(this, 'AliasRecord', {
      zone: hostedZone,
      recordName: `app.${domainName}`,
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)),
    });

    // 6. Tags
    cdk.Tags.of(this).add('Project', 'AppName');
    cdk.Tags.of(this).add('Environment', stage);
    cdk.Tags.of(this).add('Component', 'Frontend');
  }
}
```

### Cron/Scheduled Lambda Pattern (`infra/cron.ts`)

```typescript
export class CronStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: CronStackProps) {
    super(scope, id, props);

    const cronLambda = new lambda.Function(this, 'CronLambda', {
      functionName: `${props.stage}-appname-cron`,
      runtime: lambda.Runtime.NODEJS_LATEST,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '..', 'apps', 'cron', 'dist')),
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      environment: { /* ... */ },
    });

    // EventBridge rules with different schedules
    const monthlyRule = new events.Rule(this, 'MonthlyRule', {
      schedule: events.Schedule.cron({ minute: '0', hour: '11', day: '1', month: '*' }),
    });
    monthlyRule.addTarget(new targets.LambdaFunction(cronLambda, {
      event: events.RuleTargetInput.fromObject({ event: 'generateMonthlyReports' })
    }));

    const fiveMinRule = new events.Rule(this, 'FiveMinRule', {
      schedule: events.Schedule.rate(cdk.Duration.minutes(5)),
    });
    fiveMinRule.addTarget(new targets.LambdaFunction(cronLambda, {
      event: events.RuleTargetInput.fromObject({ event: 'processQueue' })
    }));
  }
}
```

---

## 7. Naming Conventions

### Files
| Type | Pattern | Example |
|------|---------|---------|
| Controller | `{feature}.controller.ts` | `orders.controller.ts` |
| Service | `{feature}.service.ts` | `orders.service.ts` |
| Utilities | `{feature}.utils.ts` | `orders.utils.ts` |
| Middleware | `{name}.middleware.ts` | `auth.middleware.ts` |
| DTO | `{domain}.ts` (in packages/dto) | `orders.ts` |
| Page | `index.tsx` in a named directory | `pages/orders/index.tsx` |
| API client | `{domain}.ts` (in src/api/) | `api/orders.ts` |

### TypeScript
| Type | Convention | Example |
|------|-----------|---------|
| Zod schema | camelCase + `Dto` suffix | `filterOrdersDto` |
| Inferred type | PascalCase + `Dto` suffix | `FilterOrdersDto` |
| Response type | Prisma payload + `Dto` suffix | `OrdersResponseDto` |
| Controller | camelCase + `Controller` | `ordersController` |
| Service function | camelCase verb | `getOrders`, `refundOrder` |
| Middleware | camelCase | `authMiddleware`, `requireRole` |
| Error class | PascalCase + `Error` | `AppError`, `ClientError` |

### CDK
| Type | Convention | Example |
|------|-----------|---------|
| Stack name | `{App}-{Name}Stack-{stage}` | `Ezlanes-ApiStack-prod` |
| Lambda name | `{stage}-{app}-{feature}` | `prod-ezlanes-api` |
| S3 bucket | `{stage}-{app}-{purpose}-{domain}` | `prod-ezlanes-frontend-otterorder-com` |
| API GW name | `{stage}-{app}-api` | `prod-ezlanes-api` |
| Props interface | `{Stack}Props` | `ApiStackProps` |

### Routes
| Pattern | Example |
|---------|---------|
| Collection | `GET /orders` |
| Single item | `GET /orders/:id` |
| Action | `POST /orders/:id/refund` |
| Nested collection | `GET /orders/:id/items` |

---

## 8. Key Architecture Decisions

1. **Single Lambda per API**: All API routes bundle into one Lambda function behind API Gateway proxy integration. Not one Lambda per route.

2. **Prisma in Lambda**: Uses `PrismaPg` driver adapter + `queryCompiler` WASM for Lambda-compatible database access. The WASM file must be copied to the dist folder.

3. **Cookie-based auth**: JWT tokens are stored in HTTP-only cookies (not Authorization headers). `withCredentials: true` on frontend.

4. **Tenant isolation**: Every database query filters by `tenantId` from the authenticated user's JWT payload. Middleware enforces this.

5. **Shared DTOs**: Zod schemas in `packages/dto/` are the single source of truth for request/response shapes. Used for both backend validation and frontend type inference.

6. **CloudFront for SPAs**: Each frontend app gets its own S3 bucket + CloudFront distribution. Error pages return `index.html` for client-side routing.

7. **Secrets via ARN**: In production, secrets (DB creds, JWT secret, API keys) are fetched from AWS Secrets Manager by ARN. In development, values are passed directly via `.env`.

8. **Provisioned concurrency**: The main API Lambda uses provisioned concurrency (min 3) with auto-scaling up to 200, targeting 85% utilization.

9. **Frontend deploys**: Static assets are synced to S3 via `aws s3 sync`, then CloudFront cache is invalidated.

---

## 9. Development Workflow

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# Start backend API
npm run dev:api          # runs on http://localhost:4200

# Start a frontend app
npm run dev:dashboard    # runs on http://localhost:5173

# Build everything
npm run build

# Deploy infrastructure
npm run cdk:deploy

# Deploy frontend to S3
npm run deploy:dashboard
npm run invalidate:dashboard
```

### `.gitignore`
```
node_modules
dist
dist-storefront
.env
cdk.out
.DS_Store
*.pem
```
