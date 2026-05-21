import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { clientUpdateDto, clientsListQueryDto } from '@bookla/dto/clients';
import { idValidator } from '@bookla/dto';
import { authMiddleware } from '../../middleware/auth.middleware';
import { getClient, listClients, updateClient } from './clients.service';

export const clientsController = new Hono()
  .use('*', authMiddleware)

  .get('/', zValidator('query', clientsListQueryDto), async (c) => {
    const result = await listClients(c.get('user'), c.req.valid('query'));
    return c.json(result);
  })

  .get('/:id', zValidator('param', idValidator), async (c) => {
    const row = await getClient(c.get('user'), c.req.valid('param').id);
    return c.json(row);
  })

  .patch(
    '/:id',
    zValidator('param', idValidator),
    zValidator('json', clientUpdateDto),
    async (c) => {
      const row = await updateClient(
        c.get('user'),
        c.req.valid('param').id,
        c.req.valid('json'),
      );
      return c.json(row);
    },
  );
