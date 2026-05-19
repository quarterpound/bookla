import { HTTPException } from 'hono/http-exception';
import { getPrismaClient } from '../../db';
import type { AuthUser } from '../../middleware/auth.middleware';
import type { ServiceCreateDto, ServiceUpdateDto } from '@bookla/dto/services';

export const listServices = async (user: AuthUser) => {
  const db = await getPrismaClient();
  return db.service.findMany({
    where: { tenantId: user.tenantId },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  });
};

export const getService = async (user: AuthUser, id: number) => {
  const db = await getPrismaClient();
  const service = await db.service.findFirst({
    where: { id, tenantId: user.tenantId },
  });
  if (!service) throw new HTTPException(404, { message: 'Service not found' });
  return service;
};

export const createService = async (user: AuthUser, dto: ServiceCreateDto) => {
  const db = await getPrismaClient();

  // Default sortOrder to max+1 so the new row appears at the end of the list.
  const sortOrder =
    dto.sortOrder ??
    (await db.service
      .findFirst({
        where: { tenantId: user.tenantId },
        orderBy: { sortOrder: 'desc' },
        select: { sortOrder: true },
      })
      .then((row) => (row ? row.sortOrder + 1 : 0)));

  return db.service.create({
    data: {
      tenantId: user.tenantId,
      name: dto.name,
      durationMinutes: dto.durationMinutes,
      priceAmount: dto.priceAmount,
      currency: dto.currency ?? 'AZN',
      sortOrder,
    },
  });
};

export const updateService = async (user: AuthUser, id: number, dto: ServiceUpdateDto) => {
  const db = await getPrismaClient();
  // Confirm ownership before updating; Prisma's `where` clause doesn't accept
  // compound (id + tenantId) for `update`, so we use updateMany + count check.
  const result = await db.service.updateMany({
    where: { id, tenantId: user.tenantId },
    data: {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.durationMinutes !== undefined && { durationMinutes: dto.durationMinutes }),
      ...(dto.priceAmount !== undefined && { priceAmount: dto.priceAmount }),
      ...(dto.currency !== undefined && { currency: dto.currency }),
      ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
    },
  });
  if (result.count === 0) throw new HTTPException(404, { message: 'Service not found' });
  return getService(user, id);
};

export const deactivateService = async (user: AuthUser, id: number) => {
  // Soft delete only — past bookings still reference this service row.
  return updateService(user, id, { isActive: false });
};
