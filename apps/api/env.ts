import { z } from 'zod';
import dotenv from 'dotenv';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
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

    // Comma-separated list of origins permitted for CORS.
    ALLOWED_ORIGINS: z
      .string()
      .default('http://localhost:5173')
      .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean)),

    // Cookie domain — leave unset for localhost.
    COOKIE_DOMAIN: z.string().optional(),
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
