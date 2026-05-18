import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { handle } from 'hono/aws-lambda';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { env } from './env';
import { getPrismaClient } from './db';
import { AppError } from './utils/errors';
import { authController } from './routes/auth/auth.controller';
import { tenantsController } from './routes/tenants/tenants.controller';

const allowedOrigins = env.ALLOWED_ORIGINS;

export const app = new Hono()
  .use(
    '*',
    cors({
      origin: (origin) => {
        if (!origin) return null;
        return allowedOrigins.includes(origin) ? origin : null;
      },
      allowHeaders: ['Content-Type', 'Authorization'],
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      credentials: true,
    }),
  )

  .get('/health', async (c) => {
    const prisma = await getPrismaClient();
    await prisma.$queryRaw`SELECT 1`;
    return c.json({ status: 'healthy', timestamp: new Date().toISOString() });
  })

  .onError((err, c) => {
    if (err instanceof AppError) {
      return c.json(
        { error: err.message, code: err.code, type: 'app-error' },
        err.status ?? 500,
      );
    }
    if (err instanceof HTTPException) {
      return c.json({ error: err.message, type: 'http-error' }, err.status);
    }
    console.error('Unhandled error:', err);
    return c.json({ error: 'Internal server error', type: 'unhandled' }, 500);
  })

  .route('/auth', authController)
  .route('/tenants', tenantsController);

export type AppType = typeof app;

export const handler = handle(app);

if (env.NODE_ENV === 'development') {
  serve({ fetch: app.fetch, port: env.PORT }, (info) => {
    console.log(`API listening on http://localhost:${info.port}`);
  });
}
