/**
 * Rutas de autenticación (capa routes: solo Zod + llamada al service; sin lógica).
 *
 * POST /api/v1/auth/dev-login — SOLO montada con AUTH_MODE=dev.
 * Body: { correo }. Responde con el token Bearer en el body (para Swagger y
 * los curl) Y fija la cookie httpOnly `membrio_session` que usa el cliente web
 * (spec del cliente §6): SameSite=Lax, Path=/, Max-Age = expiración del JWT,
 * Secure solo en producción.
 *
 * POST /api/v1/auth/logout — borra esa cookie (requiere sesión).
 */
import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { z } from '@hono/zod-openapi';
import { setCookie } from 'hono/cookie';
import type { Context } from 'hono';

import { entorno } from '../config/env';
import { COOKIE_SESION, requerirAuth, type EnvAplicacion } from '../middleware/auth';
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

const ATRIBUTOS_COOKIE = {
  httpOnly: true,
  sameSite: 'Lax' as const,
  path: '/',
  secure: entorno.NODE_ENV === 'production',
} as const;

/** Fija la cookie de sesión con la misma vida que el JWT. */
function fijarCookieSesion(c: Context, token: string, expiraEn: number): void {
  const ahora = Math.floor(Date.now() / 1000);
  setCookie(c, COOKIE_SESION, token, { ...ATRIBUTOS_COOKIE, maxAge: Math.max(expiraEn - ahora, 0) });
}

/** Borra la cookie de sesión (mismos atributos para que el navegador la elimine). */
function borrarCookieSesion(c: Context): void {
  setCookie(c, COOKIE_SESION, '', { ...ATRIBUTOS_COOKIE, maxAge: 0 });
}

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
    'Correos inexistentes o inactivos responden 401 idéntico: no se revela existencia de cuentas. ' +
    'Además del token en el body, fija la cookie httpOnly membrio_session (Path=/, SameSite=Lax, ' +
    'Max-Age = expiración del JWT, Secure en producción) para el cliente web.',
  security: [], // ruta pública: no lleva Bearer (excepción a la seguridad global)
  request: {
    body: { content: { 'application/json': { schema: esquemaLogin } }, required: true },
  },
  responses: {
    200: { description: 'Sesión iniciada', content: { 'application/json': { schema: sesionSchema } } },
    ...respuestasError(400, 401),
  },
});

const rutaLogout = createRoute({
  method: 'post',
  path: '/api/v1/auth/logout',
  summary: 'Cierra la sesión: borra la cookie membrio_session',
  description:
    'Requiere sesión (Bearer o cookie). Autenticada por cookie + método mutante exige origen del ' +
    'mismo sitio (defensa CSRF, spec del cliente §6). El token del body sigue siendo válido: ' +
    'logout solo cierra la sesión en este navegador.',
  middleware: [requerirAuth] as const,
  responses: {
    204: { description: 'Sesión cerrada: cookie borrada' },
    ...respuestasError(401, 403),
  },
});

export const rutasAuth = new OpenAPIHono<EnvAplicacion>();

rutasAuth.openapi(rutaLogout, async (c) => {
  borrarCookieSesion(c);
  return c.body(null, 204);
});

if (entorno.AUTH_MODE === 'dev') {
  rutasAuth.openapi(rutaDevLogin, async (c) => {
    const sesion = await iniciarSesionDev(c.req.valid('json').correo);
    fijarCookieSesion(c, sesion.token, sesion.expira_en ?? Math.floor(Date.now() / 1000) + 12 * 3600);
    return c.json(serializar(sesionSchema, sesion), 200);
  });
}
