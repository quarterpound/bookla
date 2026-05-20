import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { blockedPhoneCreateDto } from '@bookla/dto/blocked-phones';
import { idValidator } from '@bookla/dto';
import { authMiddleware, requireRole } from '../../middleware/auth.middleware';
import {
  createBlockedPhone,
  deleteBlockedPhone,
  listBlockedPhones,
} from './blocked-phones.service';

/**
 * Owner / manager-only — staff members shouldn't be adding bans on their own.
 * `requireRole('manager')` passes owners + admins + managers (see auth.middleware).
 */
export const blockedPhonesController = new Hono()
  .use('*', authMiddleware)
  .use('*', requireRole('manager'))

  .get('/', async (c) => {
    const rows = await listBlockedPhones(c.get('user'));
    return c.json(rows);
  })

  .post('/', zValidator('json', blockedPhoneCreateDto), async (c) => {
    const row = await createBlockedPhone(c.get('user'), c.req.valid('json'));
    return c.json(row, 201);
  })

  .delete('/:id', zValidator('param', idValidator), async (c) => {
    const res = await deleteBlockedPhone(c.get('user'), c.req.valid('param').id);
    return c.json(res);
  });
