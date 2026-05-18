import { sign, verify } from 'hono/jwt';
import { env } from '../env';
import { fetchStringSecretByArn } from '@bookla/utils';

export interface JwtPayload {
  userId: number;
  tenantId: number;
  /** Seconds-since-epoch. Required by hono/jwt for `exp` validation. */
  exp?: number;
  iat?: number;
}

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;
const JWT_ALG = 'HS256' as const;

// Canonical secret-consumer pattern: a module-scoped lazy promise. Initialised
// on the first sign/verify, then reused for the lifetime of the warm container.
// Do NOT await at top level — endpoints that don't need JWT shouldn't pay the
// Secrets Manager round-trip on cold start.
let secretPromise: Promise<string> | null = null;

const getJwtSecret = (): Promise<string> => {
  if (!secretPromise) {
    secretPromise = (async () => {
      const secret = await fetchStringSecretByArn(env.JWT_SECRET_ARN, env.JWT_SECRET ?? '');
      if (!secret) {
        throw new Error('JWT secret resolved to empty — set JWT_SECRET (dev) or JWT_SECRET_ARN (prod)');
      }
      return secret;
    })();
    // Evict on failure so the next caller re-fetches instead of caching the rejection.
    secretPromise.catch(() => {
      secretPromise = null;
    });
  }
  return secretPromise;
};

export const signToken = async (payload: Omit<JwtPayload, 'exp' | 'iat'>): Promise<string> => {
  const secret = await getJwtSecret();
  const now = Math.floor(Date.now() / 1000);
  return sign({ ...payload, iat: now, exp: now + TOKEN_TTL_SECONDS }, secret, JWT_ALG);
};

export const verifyToken = async (token: string): Promise<JwtPayload> => {
  const secret = await getJwtSecret();
  const payload = await verify(token, secret, JWT_ALG);
  return payload as unknown as JwtPayload;
};

export const tokenTtlSeconds = TOKEN_TTL_SECONDS;
