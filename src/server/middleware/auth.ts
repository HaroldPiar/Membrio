/**
 * Autenticación y contexto de tenant (spec §5).
 *
 * Flujo de requireAuth:
 *  1. Token desde Authorization: Bearer … o desde la cookie httpOnly
 *     `membrio_session` (preparado para el flujo Supabase; el dev-login
 *     devuelve el token en el body y el cliente decide cómo guardarlo).
 *  2. Verificación del JWT según AUTH_MODE (ver auth/jwt.ts).
 *  3. Búsqueda del usuario en `usuarios`: si NO existe o activo=false se
 *     rechaza 401 aunque el token sea válido (spec §5).
 *  4. El contexto { usuarioId, organizacionId, rol } se arma SOLO de esa fila:
 *     organizacion_id NUNCA viene del body, la URL ni los query params.
 *
 * 401 vs 403: sin sesión/inactivo → 401; sesión válida pero rol no alcanza → 403.
 */
import { createMiddleware } from 'hono/factory';
import type { Context } from 'hono';
import { getCookie } from 'hono/cookie';

import { verificarTokenSesion } from '../auth/jwt';
import { AppError } from '../errors';
import { obtenerUsuarioPorId } from '../repositories/usuarios';

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
  const autorizacion = c.req.header('authorization');
  if (autorizacion?.startsWith('Bearer ')) {
    const token = autorizacion.slice('Bearer '.length).trim();
    if (token) return token;
  }
  return getCookie(c)[COOKIE_SESION] || undefined;
}

/** Autenticación obligatoria: setea contexto en c.set('contexto', …). */
export const requerirAuth = createMiddleware<EnvAplicacion>(async (c, next) => {
  const token = extraerToken(c);
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
