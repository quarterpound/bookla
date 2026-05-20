import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import dotenv from 'dotenv';

if (process.env.NODE_ENV !== 'production') {
  // Resolve `.env` relative to this file so it works regardless of cwd —
  // turbo spawns dev scripts from each app's directory, not the repo root.
  const here = path.dirname(fileURLToPath(import.meta.url));
  dotenv.config({ path: path.resolve(here, '../../.env') });
}

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production']).default('development'),
    PORT: z.coerce.number().default(4200),

    DATABASE_URL: z.string().optional(),
    DATABASE_SECRET_ARN: z.string().optional(),
    DATABASE_PROXY_ENDPOINT: z.string().optional(),

    JWT_SECRET: z.string().optional(),
    JWT_SECRET_ARN: z.string().optional(),

    AWS_REGION: z.string().default('us-east-2'),

    // Comma-separated list of origins permitted for CORS. Defaults cover both
    // the dashboard (5173) and the storefront SSR app (3000) in local dev.
    ALLOWED_ORIGINS: z
      .string()
      .default('http://localhost:5173,http://localhost:3000')
      .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean)),

    // Used by apps/storefront server-side fetches to reach the API directly
    // (e.g. ALB internal hostname in prod). Not consumed by the API itself —
    // listed here so the env contract for the whole repo lives in one place.
    INTERNAL_API_URL: z.string().optional(),

    // Cookie domain — leave unset for localhost.
    COOKIE_DOMAIN: z.string().optional(),

    // SMS provider key. `console` logs the OTP to stdout (dev/default). Other
    // values are reserved for real providers (e.g. Twilio, an AZ aggregator).
    SMS_PROVIDER: z.string().default('console'),
  })
  .refine(
    (env) => {
      if (env.NODE_ENV === 'production') {
        return Boolean(env.DATABASE_SECRET_ARN && env.JWT_SECRET_ARN);
      }
      return Boolean(
        (env.DATABASE_URL || env.DATABASE_SECRET_ARN) && (env.JWT_SECRET || env.JWT_SECRET_ARN),
      );
    },
    {
      message:
        'In production: DATABASE_SECRET_ARN and JWT_SECRET_ARN required. In development: provide DATABASE_URL/JWT_SECRET or their ARN equivalents.',
    },
  );

export const env = envSchema.parse(process.env);
