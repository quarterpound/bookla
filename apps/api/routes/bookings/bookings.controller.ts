import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import {
  bookingCreateDto,
  bookingSlotsQueryDto,
  bookingUpdateDto,
  bookingsListQueryDto,
} from '@bookla/dto/bookings';
import { idValidator } from '@bookla/dto';
import { authMiddleware } from '../../middleware/auth.middleware';
import {
  createBooking,
  getAvailableSlotsForStaff,
  getBooking,
  listBookings,
  updateBooking,
} from './bookings.service';

export const bookingsController = new Hono()
  .use('*', authMiddleware)

  .get('/', zValidator('query', bookingsListQueryDto), async (c) => {
    const rows = await listBookings(c.get('user'), c.req.valid('query'));
    return c.json(rows);
  })

  // Slot picker for the manual-booking flow. Same algorithm as the public
  // endpoint but tenant comes from the JWT instead of a slug.
  .get('/available-slots', zValidator('query', bookingSlotsQueryDto), async (c) => {
    const slots = await getAvailableSlotsForStaff(c.get('user'), c.req.valid('query'));
    return c.json(slots);
  })

  .post('/', zValidator('json', bookingCreateDto), async (c) => {
    const created = await createBooking(c.get('user'), c.req.valid('json'));
    return c.json(created, 201);
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
