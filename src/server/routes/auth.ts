/**
 * Rutas de autenticación (capa routes: solo Zod + llamada al service; sin lógica).
 *
 * POST /api/v1/auth/login     — SOLO montada con AUTH_MODE=password.
 *   Body: { correo, password }. Responde con el token Bearer en el body (para Swagger y
 *   los curl) Y fija la cookie httpOnly `membrio_session` que usa el cliente web
 *   (spec del cliente §6): SameSite=Lax, Path=/, Max-Age = expiración del JWT, Secure solo en producción.
 *   Rate limit: 5 intentos fallidos por (correo normalizado + IP) cada 15 min → 429
 *   DEMASIADOS_INTENTOS; un login exitoso reinicia el contador.
 *
 * POST /api/v1/auth/dev-login — SOLO montada con AUTH_MODE=dev.
 *   Body: { correo }. Responde con el token Bearer en el body (para Swagger y
 *   los curl) Y fija la cookie httpOnly `membrio_session` que usa el cliente web
 *   (spec del cliente §6): SameSite=Lax, Path=/, Max-Age = expiración del JWT, Secure solo en producción.
 *
 * POST /api/v1/auth/logout — borra esa cookie (requiere sesión).
 *
 * NOTA (task login producción): el contrato OpenAPI siempre registra las DOS rutas
 * de login (`/auth/dev-login` y `/auth/login`); la que no corresponde al modo activo
 * se registra sin handler (vía `openAPIRegistry.registerPath`), de modo que documente
 * el contrato pero no acepte peticiones en runtime. Así el cliente tipado
 * (`pnpm api:types`) siempre compila y, por ejemplo, con `AUTH_MODE=password` un
 * `POST /auth/dev-login` llega al 404 de la API.
 */
import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { z } from '@hono/zod-openapi';
import { setCookie } from 'hono/cookie';
import type { Context } from 'hono';

import { crearLimitadorIntentos } from '../auth/rate-limit';
import { entorno } from '../config/env';
import { AppError } from '../errors';
import { COOKIE_SESION, requerirAuth, type EnvAplicacion } from '../middleware/auth';
import { iniciarSesionDev, iniciarSesionPassword } from '../services/auth';
import { serializar } from '../../shared/casing';
import { respuestasError } from '../../shared/errores';

const esquemaLogin = z.object({
  correo: z.string().trim().toLowerCase().pipe(z.email({ message: 'Correo inválido' })),
});

const esquemaInicioSesionPassword = z.object({
  correo: z.string().trim().toLowerCase().pipe(z.email({ message: 'Correo inválido' })),
  password: z
    .string()
    .min(12, { message: 'La contraseña debe tener al menos 12 caracteres' })
    .max(128, { message: 'La contraseña debe tener hasta 128 caracteres' }),
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

/** IP del cliente: primer valor de x-forwarded-for (proxy de Render) con fallback seguro. */
function ipDe(c: Context): string {
  const encabezado = c.req.header('x-forwarded-for');
  const ip = encabezado?.split(',')[0]?.trim();
  return ip ?? '127.0.0.1';
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
  security: [],
  // ruta pública: no lleva Bearer (excepción a la seguridad global)
  request: {
    body: { content: { 'application/json': { schema: esquemaLogin } }, required: true },
  },
  responses: {
    200: { description: 'Sesión iniciada', content: { 'application/json': { schema: sesionSchema } } },
    ...respuestasError(400, 401),
  },
});

const rutaLogin = createRoute({
  method: 'post',
  path: '/api/v1/auth/login',
  summary: 'Inicia sesión con correo y contraseña (SOLO AUTH_MODE=password)',
  description:
    'Credenciales propias (correo + contraseña). Correo inexistente, inactivo o contraseña ' +
    'incorrecta responden 401 idéntico CREDENCIALES_INVALIDAS. Además del token en el body, fija ' +
    'la cookie httpOnly membrio_session (Path=/, SameSite=Lax, Max-Age = expiración del JWT, Secure ' +
    'en producción). Rate limit: 5 intentos fallidos por (correo + IP) cada 15 min → 429 ' +
    'DEMASIADOS_INTENTOS; un login exitoso reinicia el contador.',
  security: [],
  // ruta pública: no lleva Bearer (excepción a la seguridad global)
  request: {
    body: { content: { 'application/json': { schema: esquemaInicioSesionPassword } }, required: true },
  },
  responses: {
    200: { description: 'Sesión iniciada', content: { 'application/json': { schema: sesionSchema } } },
    ...respuestasError(400, 401, 429),
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

const limitador = crearLimitadorIntentos();

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
} else {
  // Documentación-only: sin handler en runtime (404 RUTA_NO_ENCONTRADA).
  rutasAuth.openAPIRegistry.registerPath(rutaDevLogin);
}

if (entorno.AUTH_MODE === 'password') {
  rutasAuth.openapi(rutaLogin, async (c) => {
    const cuerpo = c.req.valid('json');
    const clave = `${cuerpo.correo}|${ipDe(c)}`;
    if (!limitador.puedeIntentar(clave)) {
      throw new AppError(429, 'DEMASIADOS_INTENTOS', 'Demasiados intentos fallidos. Esperá unos minutos antes de reintentar.');
    }
    try {
      const sesion = await iniciarSesionPassword(cuerpo.correo, cuerpo.password);
      limitador.reiniciar(clave);
      fijarCookieSesion(c, sesion.token, sesion.expira_en ?? Math.floor(Date.now() / 1000) + 12 * 3600);
      return c.json(serializar(sesionSchema, sesion), 200);
    } catch (err) {
      // Solo las credenciales fallidas consumen el cupo del rate limit.
      if (err instanceof AppError && err.status === 401) {
        limitador.registrarFallo(clave);
      }
      throw err;
    }
  });
} else {
  // Documentación-only: sin handler en runtime (404 RUTA_NO_ENCONTRADA).
  rutasAuth.openAPIRegistry.registerPath(rutaLogin);
}
