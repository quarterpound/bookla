import { HTTPException } from 'hono/http-exception';
import { getPrismaClient } from '../../db';
import { AppError } from '../../utils/errors';
import { hashPassword, verifyPassword } from '../../utils/password';
import { signToken } from '../../utils/jwt';
import type { RegisterDto, LoginDto } from '@bookla/dto/auth';
import type { AuthUser } from '../../middleware/auth.middleware';

export interface AuthResult {
  token: string;
  user: {
    id: number;
    email: string;
    name: string | null;
    role: string;
    subRole: string;
  };
  tenant: {
    id: number;
    name: string;
    slug: string;
  };
}

export const registerTenant = async (dto: RegisterDto): Promise<AuthResult> => {
  const db = await getPrismaClient();

  const existingTenant = await db.tenant.findUnique({ where: { slug: dto.tenantSlug } });
  if (existingTenant) {
    throw new AppError('Tenant slug already taken', 'SLUG_TAKEN', 400);
  }

  const passwordHash = await hashPassword(dto.password);

  const { tenant, user } = await db.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: { name: dto.tenantName, slug: dto.tenantSlug },
    });
    const user = await tx.tenantUser.create({
      data: {
        tenantId: tenant.id,
        email: dto.email,
        passwordHash,
        name: dto.name ?? null,
        role: 'owner',
        subRole: 'admin',
      },
    });
    return { tenant, user };
  });

  const token = await signToken({ userId: user.id, tenantId: tenant.id });
  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      subRole: user.subRole,
    },
    tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
  };
};

export const login = async (dto: LoginDto): Promise<AuthResult> => {
  const db = await getPrismaClient();

  // If a tenantSlug is provided, scope the lookup to that tenant; otherwise resolve by email
  // across tenants (which only works when the email is unique globally). For multi-tenant
  // logins where the same email may exist in multiple tenants, the slug is required.
  const users = await db.tenantUser.findMany({
    where: {
      email: dto.email,
      ...(dto.tenantSlug ? { tenant: { slug: dto.tenantSlug } } : {}),
    },
    include: { tenant: true },
    take: 2,
  });

  if (users.length === 0) {
    throw new HTTPException(401, { message: 'Invalid email or password' });
  }
  if (users.length > 1) {
    throw new AppError(
      'This email belongs to multiple tenants — provide tenantSlug',
      'TENANT_SLUG_REQUIRED',
      400,
    );
  }

  const user = users[0]!;
  const ok = await verifyPassword(dto.password, user.passwordHash);
  if (!ok) {
    throw new HTTPException(401, { message: 'Invalid email or password' });
  }

  await db.tenantUser.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const token = await signToken({ userId: user.id, tenantId: user.tenantId });
  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      subRole: user.subRole,
    },
    tenant: { id: user.tenant.id, name: user.tenant.name, slug: user.tenant.slug },
  };
};

export const getMe = async (authUser: AuthUser) => {
  const db = await getPrismaClient();
  const user = await db.tenantUser.findUnique({
    where: { id: authUser.userId },
    include: { tenant: true },
  });
  if (!user) {
    throw new HTTPException(401, { message: 'User not found' });
  }
  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      subRole: user.subRole,
    },
    tenant: { id: user.tenant.id, name: user.tenant.name, slug: user.tenant.slug },
  };
};
