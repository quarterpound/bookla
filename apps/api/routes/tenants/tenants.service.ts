import { HTTPException } from 'hono/http-exception';
import { getPrismaClient } from '../../db';
import type { AuthUser } from '../../middleware/auth.middleware';

export const getCurrentTenant = async (user: AuthUser) => {
  const db = await getPrismaClient();
  const tenant = await db.tenant.findUnique({
    where: { id: user.tenantId },
    include: {
      _count: { select: { users: true } },
    },
  });
  if (!tenant) {
    throw new HTTPException(404, { message: 'Tenant not found' });
  }
  return tenant;
};

export const listMembers = async (user: AuthUser) => {
  const db = await getPrismaClient();
  return db.tenantUser.findMany({
    where: { tenantId: user.tenantId },
    select: {
      id: true,
      phone: true,
      name: true,
      role: true,
      subRole: true,
      createdAt: true,
      lastLoginAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });
};
