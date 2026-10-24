/**
 * Sesiones JWT (HS256) para el modo dev y para la fase preparada de Supabase.
 *
 *  - AUTH_MODE=dev:     se firma con DEV_JWT_SECRET (solo existe POST /auth/dev-login).
 *  - AUTH_MODE=supabase: se VERIFICA con SUPABASE_JWT_SECRET (preparado, sin probar).
 *    Cuando Supabase entre de verdad, la cookie httpOnly la manejará @supabase/ssr
 *    y aquí solo quedará la verificación del access token.
 *
 * Expiración: 12 h (jornada de operación del club con margen; no es una sesión
 * de días porque cada token carga el contexto de tenant).
 */
import { SignJWT, jwtVerify } from 'jose';

import { entorno } from '../config/env';

const ALGORITMO = 'HS256';
const ISSUER = 'membrio';
const AUDIENCE = 'membrio-api';
const DURACION_HORAS = 12;

const aBytes = (secreto: string): Uint8Array => new TextEncoder().encode(secreto);

/** Firma un token de sesión (solo se usa en modo dev). */
export async function firmarTokenDev(usuarioId: string): Promise<string> {
  if (entorno.AUTH_MODE !== 'dev') {
    throw new Error('firmarTokenDev solo existe en AUTH_MODE=dev');
  }
  return new SignJWT({})
    .setProtectedHeader({ alg: ALGORITMO })
    .setSubject(usuarioId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${DURACION_HORAS}h`)
    .sign(aBytes(entorno.DEV_JWT_SECRET as string));
}

/**
 * Verifica un token de sesión según el modo activo y devuelve el usuario.
 * Lanza si el token es inválido, está vencido o tiene otro secreto/issuer.
 */
export async function verificarTokenSesion(token: string): Promise<{ usuarioId: string }> {
  const secreto = entorno.AUTH_MODE === 'dev' ? entorno.DEV_JWT_SECRET : entorno.SUPABASE_JWT_SECRET;
  const { payload } = await jwtVerify(token, aBytes(secreto as string), {
    algorithms: [ALGORITMO],
    issuer: ISSUER,
    audience: AUDIENCE,
  });
  if (!payload.sub) {
    throw new Error('Token sin subject (sub)');
  }
  return { usuarioId: payload.sub };
}

/** Expiración en segundos del token, para devolverla en el login (i/exp). */
export function expiracionSegundos(token: string): number | undefined {
  const [, cuerpo] = token.split('.');
  if (!cuerpo) return undefined;
  try {
    const payload = JSON.parse(Buffer.from(cuerpo, 'base64url').toString('utf8')) as { exp?: number };
    return payload.exp;
  } catch {
    return undefined;
  }
}
