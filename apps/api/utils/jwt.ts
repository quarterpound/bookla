import { sign, verify } from 'hono/jwt';
import { env } from '../env';
import { fetchSecretByArn } from '@bookla/utils';

export interface JwtPayload {
  userId: number;
  tenantId: number;
  /** Seconds-since-epoch. Required by hono/jwt for `exp` validation. */
  exp?: number;
  iat?: number;
}

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;
const JWT_ALG = 'HS256' as const;

let cachedSecret: string | null = null;

const getJwtSecret = async (): Promise<string> => {
  if (cachedSecret) return cachedSecret;
  let secret: string;
  if (env.JWT_SECRET_ARN) {
    secret = await fetchSecretByArn(env.JWT_SECRET_ARN);
  } else if (env.JWT_SECRET) {
    secret = env.JWT_SECRET;
  } else {
    throw new Error('JWT secret not configured');
  }
  cachedSecret = secret;
  return secret;
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
