import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { bookingUpdateDto, bookingsListQueryDto } from '@bookla/dto/bookings';
import { idValidator } from '@bookla/dto';
import { authMiddleware } from '../../middleware/auth.middleware';
import { getBooking, listBookings, updateBooking } from './bookings.service';

export const bookingsController = new Hono()
  .use('*', authMiddleware)

  .get('/', zValidator('query', bookingsListQueryDto), async (c) => {
    const rows = await listBookings(c.get('user'), c.req.valid('query'));
    return c.json(rows);
  })

  .get('/:id', zValidator('param', idValidator), async (c) => {
    const row = await getBooking(c.get('user'), c.req.valid('param').id);
    return c.json(row);
  })

  .patch(
    '/:id',
    zValidator('param', idValidator),
    zValidator('json', bookingUpdateDto),
    async (c) => {
      const row = await updateBooking(
        c.get('user'),
        c.req.valid('param').id,
        c.req.valid('json'),
      );
      return c.json(row);
    },
  );
