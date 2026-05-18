import { Hono } from 'hono';
import { authMiddleware, requireRole } from '../../middleware/auth.middleware';
import { getCurrentTenant, listMembers } from './tenants.service';

export const tenantsController = new Hono()
  .get('/current', authMiddleware, async (c) => {
    const tenant = await getCurrentTenant(c.get('user'));
    return c.json(tenant);
  })

  .get('/current/members', requireRole('manager'), async (c) => {
    const members = await listMembers(c.get('user'));
    return c.json(members);
  });
