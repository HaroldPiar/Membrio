/**
 * Rutas de autenticación (capa routes: solo Zod + llamada al service; sin lógica).
 *
 * POST /api/v1/auth/dev-login — SOLO montada con AUTH_MODE=dev.
 * Body: { correo }. Responde con el token Bearer y el usuario.
 */
import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { z } from '@hono/zod-openapi';

import { entorno } from '../config/env';
import type { EnvAplicacion } from '../middleware/auth';
import { iniciarSesionDev } from '../services/auth';
import { serializar } from '../../shared/casing';
import { respuestasError } from '../../shared/errores';

const esquemaLogin = z.object({
  correo: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ message: 'Correo inválido' })),
});

const sesionSchema = z
  .object({
    token: z.string().openapi({ description: 'JWT Bearer (HS256)' }),
    token_type: z.literal('Bearer'),
    expira_en: z.number().nullish().openapi({ description: 'Unix seconds (exp del JWT)' }),
    usuario: z.object({
      id: z.uuid(),
      correo: z.string(),
      nombre: z.string(),
      rol: z.string(),
      organizacion_id: z.uuid(),
    }),
  })
  .openapi('Sesion');

const rutaDevLogin = createRoute({
  method: 'post',
  path: '/api/v1/auth/dev-login',
  summary: 'Inicia sesión con un correo de usuario (SOLO AUTH_MODE=dev)',
  description:
    'Correos inexistentes o inactivos responden 401 idéntico: no se revela existencia de cuentas.',
  security: [], // ruta pública: no lleva Bearer (excepción a la seguridad global)
  request: {
    body: { content: { 'application/json': { schema: esquemaLogin } }, required: true },
  },
  responses: {
    200: { description: 'Sesión iniciada', content: { 'application/json': { schema: sesionSchema } } },
    ...respuestasError(400, 401),
  },
});

export const rutasAuth = new OpenAPIHono<EnvAplicacion>();

if (entorno.AUTH_MODE === 'dev') {
  rutasAuth.openapi(rutaDevLogin, async (c) => {
    const sesion = await iniciarSesionDev(c.req.valid('json').correo);
    return c.json(serializar(sesionSchema, sesion), 200);
  });
}
