import type { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { getCookie } from 'hono/cookie';
import { getPrismaClient } from '../db';
import { verifyToken } from '../utils/jwt';
import type { UserRole, UserSubRole } from '@bookla/db';

export interface AuthUser {
  userId: number;
  tenantId: number;
  role: UserRole;
  subRole: UserSubRole;
  email: string;
}

declare module 'hono' {
  interface ContextVariableMap {
    user: AuthUser;
  }
}

export const AUTH_COOKIE = 'token';

export const authMiddleware = async (c: Context, next: Next) => {
  const token = getCookie(c, AUTH_COOKIE);
  if (!token) throw new HTTPException(401, { message: 'Authentication token missing' });

  let payload;
  try {
    payload = await verifyToken(token);
  } catch {
    throw new HTTPException(401, { message: 'Invalid or expired token' });
  }

  const db = await getPrismaClient();
  const user = await db.tenantUser.findUnique({
    where: { id: payload.userId },
    select: { id: true, tenantId: true, role: true, subRole: true, email: true },
  });
  if (!user) throw new HTTPException(401, { message: 'User not found' });

  // Defense in depth: the JWT could have been issued before a tenant move.
  if (user.tenantId !== payload.tenantId) {
    throw new HTTPException(401, { message: 'Token tenant mismatch' });
  }

  c.set('user', {
    userId: user.id,
    tenantId: user.tenantId,
    role: user.role,
    subRole: user.subRole,
    email: user.email,
  });
  await next();
};

export const requireRole = (...allowedSubRoles: UserSubRole[]) => {
  return async (c: Context, next: Next) => {
    let user = c.get('user');
    if (!user) {
      await authMiddleware(c, async () => {});
      user = c.get('user');
    }
    if (user.role === 'owner' || user.subRole === 'admin') {
      await next();
      return;
    }
    if (!allowedSubRoles.includes(user.subRole)) {
      throw new HTTPException(403, { message: 'Insufficient permissions' });
    }
    await next();
  };
};

/**
 * Enforce that a `:tenantId` (or aliased) URL parameter matches the caller's tenant.
 * Tenant isolation is *also* enforced via `tenantId` filters in every query — this
 * guard catches accidental cross-tenant URL access at the edge.
 */
export const requireTenant = (paramName = 'tenantId') => {
  return async (c: Context, next: Next) => {
    const user = c.get('user');
    if (!user) throw new HTTPException(401, { message: 'Not authenticated' });
    const raw = c.req.param(paramName);
    if (raw === undefined) {
      throw new HTTPException(400, { message: `Missing ${paramName} param` });
    }
    if (Number(raw) !== user.tenantId) {
      throw new HTTPException(403, { message: 'Tenant mismatch' });
    }
    await next();
  };
};
