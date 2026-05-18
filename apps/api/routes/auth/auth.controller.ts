import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { setCookie, deleteCookie } from 'hono/cookie';
import { loginDto, registerDto } from '@bookla/dto/auth';
import { AUTH_COOKIE, authMiddleware } from '../../middleware/auth.middleware';
import { tokenTtlSeconds } from '../../utils/jwt';
import { env } from '../../env';
import { getMe, login, registerTenant } from './auth.service';

const isProd = env.NODE_ENV === 'production';

const setAuthCookie = (c: Parameters<typeof setCookie>[0], token: string) => {
  setCookie(c, AUTH_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'None' : 'Lax',
    path: '/',
    maxAge: tokenTtlSeconds,
    domain: env.COOKIE_DOMAIN,
  });
};

export const authController = new Hono()
  .post('/register', zValidator('json', registerDto), async (c) => {
    const result = await registerTenant(c.req.valid('json'));
    setAuthCookie(c, result.token);
    return c.json({ user: result.user, tenant: result.tenant });
  })

  .post('/login', zValidator('json', loginDto), async (c) => {
    const result = await login(c.req.valid('json'));
    setAuthCookie(c, result.token);
    return c.json({ user: result.user, tenant: result.tenant });
  })

  .post('/logout', async (c) => {
    deleteCookie(c, AUTH_COOKIE, {
      path: '/',
      domain: env.COOKIE_DOMAIN,
      secure: isProd,
      sameSite: isProd ? 'None' : 'Lax',
    });
    return c.json({ ok: true });
  })

  .get('/me', authMiddleware, async (c) => {
    const me = await getMe(c.get('user'));
    return c.json(me);
  });
