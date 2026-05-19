import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { serviceCreateDto, serviceUpdateDto } from '@bookla/dto/services';
import { idValidator } from '@bookla/dto';
import { authMiddleware } from '../../middleware/auth.middleware';
import {
  createService,
  deactivateService,
  getService,
  listServices,
  updateService,
} from './services.service';

export const servicesController = new Hono()
  .use('*', authMiddleware)

  .get('/', async (c) => {
    const rows = await listServices(c.get('user'));
    return c.json(rows);
  })

  .post('/', zValidator('json', serviceCreateDto), async (c) => {
    const created = await createService(c.get('user'), c.req.valid('json'));
    return c.json(created, 201);
  })

  .get('/:id', zValidator('param', idValidator), async (c) => {
    const row = await getService(c.get('user'), c.req.valid('param').id);
    return c.json(row);
  })

  .patch(
    '/:id',
    zValidator('param', idValidator),
    zValidator('json', serviceUpdateDto),
    async (c) => {
      const row = await updateService(
        c.get('user'),
        c.req.valid('param').id,
        c.req.valid('json'),
      );
      return c.json(row);
    },
  )

  .delete('/:id', zValidator('param', idValidator), async (c) => {
    const row = await deactivateService(c.get('user'), c.req.valid('param').id);
    return c.json(row);
  });
