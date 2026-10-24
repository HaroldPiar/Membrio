/**
 * GET /api/v1/eps (spec §9): catálogo GLOBAL, solo lectura, no requiere
 * paginación (son pocas filas de referencia).
 */
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';

import type { EnvAplicacion } from '../middleware/auth';
import { requerirAuth } from '../middleware/auth';
import { listarEps } from '../services/catalogos';
import { serializar } from '../../shared/casing';
import { epsSchema } from '../../shared/catalogos';
import { respuestasError } from '../../shared/errores';

const rutaListar = createRoute({
  method: 'get',
  path: '/api/v1/eps',
  summary: 'Catálogo global de EPS (solo lectura)',
  request: {
    query: z.object({
      activa: z.coerce.boolean().optional().openapi({ description: 'true/false; por defecto todas' }),
    }),
  },
  responses: {
    200: {
      description: 'Catálogo de EPS',
      content: { 'application/json': { schema: z.array(epsSchema) } },
    },
    ...respuestasError(400, 401),
  },
});

export const rutasEps = new OpenAPIHono<EnvAplicacion>();

rutasEps.use('/api/v1/eps/*', requerirAuth);

rutasEps.openapi(rutaListar, async (c) => {
  const filas = await listarEps({ activa: c.req.valid('query').activa });
  return c.json(serializar(z.array(epsSchema), filas), 200);
});
