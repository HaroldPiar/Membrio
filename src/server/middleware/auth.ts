/**
 * Autenticación y contexto de tenant (spec §5).
 *
 * Flujo de requireAuth:
 *  1. Token desde Authorization: Bearer … o, en su defecto, desde la cookie
 *     httpOnly `membrio_session` (la fija el dev-login; el token del body
 *     sigue existiendo para Swagger y los curl).
 *  2. Verificación del JWT según AUTH_MODE (ver auth/jwt.ts).
 *  3. Búsqueda del usuario en `usuarios`: si NO existe o activo=false se
 *     rechaza 401 aunque el token sea válido (spec §5).
 *  4. El contexto { usuarioId, organizacionId, rol } se arma SOLO de esa fila:
 *     organizacion_id NUNCA viene del body, la URL ni los query params.
 *  5. Si la autenticación fue POR COOKIE y el método es mutante, se exige
 *     origen del mismo sitio (defensa CSRF, spec del cliente §6): 403.
 *
 * 401 vs 403: sin sesión/inactivo → 401; sesión válida pero rol no alcanza → 403.
 */
import { createMiddleware } from 'hono/factory';
import type { Context } from 'hono';
import { getCookie } from 'hono/cookie';

import { verificarTokenSesion } from '../auth/jwt';
import { AppError } from '../errors';
import { obtenerUsuarioPorId } from '../repositories/usuarios';
import { rechazarCsrf, type OrigenToken } from './csrf';

export type ContextoTenant = {
  readonly usuarioId: string;
  readonly organizacionId: string;
  readonly rol: string;
};

export type EnvAplicacion = {
  Variables: {
    contexto: ContextoTenant;
  };
};

export const COOKIE_SESION = 'membrio_session';

/** Extrae el token: primero Authorization: Bearer, luego la cookie de sesión. */
export function extraerToken(c: Context<EnvAplicacion>): string | undefined {
  return extraerTokenConOrigen(c).token;
}

/** Igual que extraerToken pero declara de dónde salió (para la defensa CSRF). */
export function extraerTokenConOrigen(c: Context<EnvAplicacion>): { token: string | undefined; origen: OrigenToken } {
  const autorizacion = c.req.header('authorization');
  if (autorizacion?.startsWith('Bearer ')) {
    const token = autorizacion.slice('Bearer '.length).trim();
    if (token) return { token, origen: 'bearer' };
  }
  const cookie = getCookie(c)[COOKIE_SESION];
  if (cookie) return { token: cookie, origen: 'cookie' };
  return { token: undefined, origen: 'ninguno' };
}

/** Autenticación obligatoria: setea contexto en c.set('contexto', …). */
export const requerirAuth = createMiddleware<EnvAplicacion>(async (c, next) => {
  const { token, origen } = extraerTokenConOrigen(c);
  if (!token) {
    throw new AppError(401, 'SESION_INVALIDA', 'Se requiere sesión: envíe Authorization: Bearer <token>');
  }

  let usuarioId: string;
  try {
    ({ usuarioId } = await verificarTokenSesion(token));
  } catch {
    // Token inválido, vencido o firmado con otro secreto: misma respuesta.
    throw new AppError(401, 'SESION_INVALIDA', 'Token inválido o expirado');
  }

  const usuario = await obtenerUsuarioPorId(usuarioId);
  if (!usuario || !usuario.activo) {
    // Usuario inactivo (dado de baja) se rechaza aunque el JWT sea válido.
    throw new AppError(401, 'USUARIO_INACTIVO', 'Usuario inactivo o inexistente');
  }

  // Defensa CSRF (spec del cliente §6): cookie + método mutante exige origen propio.
  if (
    rechazarCsrf({
      metodo: c.req.method,
      origenToken: origen,
      origin: c.req.header('origin') ?? undefined,
      secFetchSite: c.req.header('sec-fetch-site') ?? undefined,
      host: c.req.header('host') ?? new URL(c.req.url).host,
    })
  ) {
    throw new AppError(403, 'CSRF_RECHAZADO', 'Origen no permitido para esta operación');
  }

  c.set(
    'contexto',
    Object.freeze({
      usuarioId: usuario.id,
      organizacionId: usuario.organizacionId,
      rol: usuario.rol,
    }),
  );
  await next();
});

/** Exige que el rol del contexto esté en la lista (matriz de permisos §4). */
export function requerirRol(...permitidos: string[]) {
  return createMiddleware<EnvAplicacion>(async (c, next) => {
    const contexto = c.get('contexto');
    if (!contexto || !permitidos.includes(contexto.rol)) {
      throw new AppError(403, 'PERMISO_INSUFICIENTE', `Requiere uno de estos roles: ${permitidos.join(', ')}`);
    }
    await next();
  });
}

/** Lectura tipada del contexto en handlers (siempre tras requerirAuth). */
export function contextoDe(c: { get: (key: 'contexto') => ContextoTenant }): ContextoTenant {
  return c.get('contexto');
}
