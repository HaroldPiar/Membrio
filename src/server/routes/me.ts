/**
 * GET /api/v1/me (spec §9): el usuario autenticado, su rol y su organización.
 * Sirve además como prueba de la cadena de auth: token → usuario → contexto.
 */
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';

import type { EnvAplicacion } from '../middleware/auth';
import { contextoDe, requerirAuth } from '../middleware/auth';
import { resumenUsuario } from '../services/auth';
import { obtenerUsuarioPorId } from '../repositories/usuarios';
import { AppError } from '../errors';
import { serializar } from '../../shared/casing';
import { respuestasError } from '../../shared/errores';

const meSchema = z
  .object({
    id: z.uuid(),
    correo: z.string().openapi({ example: 'admin@truchas.test' }),
    nombre: z.string(),
    rol: z.string().openapi({ example: 'admin' }),
    organizacion_id: z.uuid(),
  })
  .openapi('Me');

const rutaMeRuta = createRoute({
  method: 'get',
  path: '/api/v1/me',
  summary: 'Usuario autenticado, rol y organización',
  responses: {
    200: { description: 'Sesión actual', content: { 'application/json': { schema: meSchema } } },
    ...respuestasError(400, 401),
  },
});

export const rutaMe = new OpenAPIHono<EnvAplicacion>();

rutaMe.use('/api/v1/me/*', requerirAuth);

rutaMe.openapi(rutaMeRuta, async (c) => {
  const usuario = await obtenerUsuarioPorId(contextoDe(c).usuarioId);
  if (!usuario) {
    // No debería pasar: requerirAuth ya lo cargó. Defensa ante carreras (borrado entre medio).
    throw new AppError(401, 'SESION_INVALIDA', 'Usuario inexistente');
  }
  return c.json(serializar(meSchema, resumenUsuario(usuario)), 200);
});
