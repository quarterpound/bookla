import { HTTPException } from 'hono/http-exception';
import { getPrismaClient } from '../../db';
import type { AuthUser } from '../../middleware/auth.middleware';

/**
 * Resolve the authed user's own Staff row. Onboarding always creates one,
 * so a 404 here means the user is signed in but hasn't completed onboarding —
 * the dashboard's redirect should already prevent that state from reaching here.
 *
 * Task 12 (Staff management) will add list/create/update/delete on top of this.
 */
export const getMyStaff = async (user: AuthUser) => {
  const db = await getPrismaClient();
  const staff = await db.staff.findFirst({
    where: { tenantId: user.tenantId, userId: user.userId },
    orderBy: { id: 'asc' },
  });
  if (!staff) throw new HTTPException(404, { message: 'Staff row not found for this user' });
  return staff;
};
