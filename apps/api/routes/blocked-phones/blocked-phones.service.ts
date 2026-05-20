import { HTTPException } from 'hono/http-exception';
import type { BlockedPhoneCreateDto } from '@bookla/dto/blocked-phones';
import { getPrismaClient } from '../../db';
import { AppError } from '../../utils/errors';
import type { AuthUser } from '../../middleware/auth.middleware';

export const listBlockedPhones = async (user: AuthUser) => {
  const db = await getPrismaClient();
  return db.blockedPhone.findMany({
    where: { tenantId: user.tenantId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      phone: true,
      reason: true,
      blockedByUserId: true,
      createdAt: true,
    },
  });
};

export const createBlockedPhone = async (user: AuthUser, dto: BlockedPhoneCreateDto) => {
  const db = await getPrismaClient();
  try {
    return await db.blockedPhone.create({
      data: {
        tenantId: user.tenantId,
        phone: dto.phone,
        reason: dto.reason ?? null,
        blockedByUserId: user.userId,
      },
      select: {
        id: true,
        phone: true,
        reason: true,
        blockedByUserId: true,
        createdAt: true,
      },
    });
  } catch (err) {
    // Unique (tenantId, phone) — phone is already blocked. Idempotent feel.
    if ((err as { code?: string }).code === 'P2002') {
      throw new AppError('Phone is already blocked', 'PHONE_ALREADY_BLOCKED', 409);
    }
    throw err;
  }
};

export const deleteBlockedPhone = async (user: AuthUser, id: number) => {
  const db = await getPrismaClient();
  // updateMany-style guard: only delete when this row belongs to the caller's tenant.
  const result = await db.blockedPhone.deleteMany({
    where: { id, tenantId: user.tenantId },
  });
  if (result.count === 0) {
    throw new HTTPException(404, { message: 'Blocked phone not found' });
  }
  return { ok: true } as const;
};
