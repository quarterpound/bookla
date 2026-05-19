import { Hono } from 'hono';
import { authMiddleware } from '../../middleware/auth.middleware';
import { getMyStaff } from './staff.service';

export const staffController = new Hono()
  .use('*', authMiddleware)
  .get('/me', async (c) => {
    const row = await getMyStaff(c.get('user'));
    return c.json(row);
  });
