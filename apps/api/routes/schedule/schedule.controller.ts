import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import {
  dayOffCreateDto,
  daysOffQueryDto,
  workingIntervalsWeekDto,
} from '@bookla/dto/schedule';
import { idValidator } from '@bookla/dto';
import { authMiddleware } from '../../middleware/auth.middleware';
import {
  createDayOff,
  deleteDayOff,
  listDaysOff,
  listWorkingIntervals,
  replaceWorkingIntervals,
} from './schedule.service';

const staffIdParam = z.object({ staffId: z.coerce.number().int().positive() });

export const scheduleController = new Hono()
  .use('*', authMiddleware)

  .get('/:staffId/intervals', zValidator('param', staffIdParam), async (c) => {
    const rows = await listWorkingIntervals(c.get('user'), c.req.valid('param').staffId);
    return c.json(rows);
  })

  .put(
    '/:staffId/intervals',
    zValidator('param', staffIdParam),
    zValidator('json', workingIntervalsWeekDto),
    async (c) => {
      const rows = await replaceWorkingIntervals(
        c.get('user'),
        c.req.valid('param').staffId,
        c.req.valid('json'),
      );
      return c.json(rows);
    },
  )

  .get(
    '/:staffId/days-off',
    zValidator('param', staffIdParam),
    zValidator('query', daysOffQueryDto),
    async (c) => {
      const rows = await listDaysOff(
        c.get('user'),
        c.req.valid('param').staffId,
        c.req.valid('query'),
      );
      return c.json(rows);
    },
  )

  .post('/days-off', zValidator('json', dayOffCreateDto), async (c) => {
    const row = await createDayOff(c.get('user'), c.req.valid('json'));
    return c.json(row, 201);
  })

  .delete('/days-off/:id', zValidator('param', idValidator), async (c) => {
    const result = await deleteDayOff(c.get('user'), c.req.valid('param').id);
    return c.json(result);
  });
