import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import {
  publicBookingCreateDto,
  publicCalendarQueryDto,
  publicPublicIdParamDto,
  publicSlotsQueryDto,
  publicSlugParamDto,
} from '@bookla/dto/public';
import {
  createPublicBooking,
  getPublicBooking,
  getPublicBusiness,
  getPublicCalendar,
  getPublicSlots,
} from './public.service';

/**
 * Public storefront endpoints — no auth. The business `slug` (or booking
 * `publicId`) is the only identifier a client needs.
 */
export const publicController = new Hono()
  .get('/business/:slug', zValidator('param', publicSlugParamDto), async (c) => {
    const payload = await getPublicBusiness(c.req.valid('param').slug);
    return c.json(payload);
  })

  .get(
    '/business/:slug/slots',
    zValidator('param', publicSlugParamDto),
    zValidator('query', publicSlotsQueryDto),
    async (c) => {
      const slots = await getPublicSlots(
        c.req.valid('param').slug,
        c.req.valid('query'),
      );
      return c.json(slots);
    },
  )

  .get(
    '/business/:slug/calendar',
    zValidator('param', publicSlugParamDto),
    zValidator('query', publicCalendarQueryDto),
    async (c) => {
      const available = await getPublicCalendar(
        c.req.valid('param').slug,
        c.req.valid('query'),
      );
      return c.json(available);
    },
  )

  .post('/bookings', zValidator('json', publicBookingCreateDto), async (c) => {
    const created = await createPublicBooking(c.req.valid('json'));
    return c.json(created, 201);
  })

  .get('/bookings/:publicId', zValidator('param', publicPublicIdParamDto), async (c) => {
    const payload = await getPublicBooking(c.req.valid('param').publicId);
    return c.json(payload);
  });
