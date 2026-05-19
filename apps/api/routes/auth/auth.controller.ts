import { Hono } from 'hono';
import type { Context } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { setCookie, deleteCookie } from 'hono/cookie';
import { onboardingDto, sendOtpDto, verifyOtpDto } from '@bookla/dto/auth';
import { AUTH_COOKIE, authMiddleware } from '../../middleware/auth.middleware';
import { tokenTtlSeconds } from '../../utils/jwt';
import { env } from '../../env';
import { completeOnboarding, getMe, sendOtp, verifyOtp } from './auth.service';

const isProd = env.NODE_ENV === 'production';

const setAuthCookie = (c: Context, token: string) => {
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
  .post('/send-otp', zValidator('json', sendOtpDto), async (c) => {
    const result = await sendOtp(c.req.valid('json'));
    return c.json(result);
  })

  .post('/verify-otp', zValidator('json', verifyOtpDto), async (c) => {
    const result = await verifyOtp(c.req.valid('json'));
    setAuthCookie(c, result.token);
    // Token is also returned in the body so a future native client (RN/Expo)
    // can stash it and send it back via Authorization: Bearer.
    return c.json(result);
  })

  .post('/onboarding', authMiddleware, zValidator('json', onboardingDto), async (c) => {
    const result = await completeOnboarding(c.get('user'), c.req.valid('json'));
    setAuthCookie(c, result.token);
    return c.json(result);
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
