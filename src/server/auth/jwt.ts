/**
 * Sesiones JWT (HS256) para los modos propios de inicio de sesión.
 *
 *  - AUTH_MODE=dev:      se firma con DEV_JWT_SECRET (solo POST /auth/dev-login).
 *  - AUTH_MODE=password: se firma con SESSION_JWT_SECRET (POST /auth/login).
 *  - AUTH_MODE=supabase: se VERIFICA con SUPABASE_JWT_SECRET (preparado, sin probar).
 *    Cuando Supabase entre de verdad, la cookie httpOnly la manejará @supabase/ssr
 *    y aquí solo quedará la verificación del access token.
 *
 * Expiración: 12 h (jornada de operación del club con margen; no es una sesión
 * de días porque cada token carga el contexto de tenant).
 */
import { SignJWT, jwtVerify } from 'jose';

import { entorno } from '../config/env';
import { huellaPassword } from './password';

const ALGORITMO = 'HS256';
const ISSUER = 'membrio';
const AUDIENCE = 'membrio-api';
const DURACION_HORAS = 12;

const aBytes = (secreto: string): Uint8Array => new TextEncoder().encode(secreto);

/** Secreto que firma/verifica en el modo activo (dev → DEV_JWT_SECRET; password → SESSION_JWT_SECRET). */
function secretoJwt(): string {
  if (entorno.AUTH_MODE === 'dev') {
    return entorno.DEV_JWT_SECRET as string;
  }
  if (entorno.AUTH_MODE === 'password') {
    return entorno.SESSION_JWT_SECRET as string;
  }
  return entorno.SUPABASE_JWT_SECRET as string;
}

/** Firma un token de sesión (solo en los modos propios: dev o password). */
export async function firmarTokenSesion(
  usuarioId: string,
  opciones?: { dcp?: boolean; passwordHash?: string | null },
): Promise<string> {
  if (entorno.AUTH_MODE !== 'dev' && entorno.AUTH_MODE !== 'password') {
    throw new Error('firmarTokenSesion solo puede usarse en AUTH_MODE=dev o AUTH_MODE=password');
  }
  const secreto = entorno.AUTH_MODE === 'dev' ? (entorno.DEV_JWT_SECRET as string) : (entorno.SESSION_JWT_SECRET as string);
  return new SignJWT({
    sub: usuarioId,
    dcp: Boolean(opciones?.dcp),
    // Huella del hash vigente: si cambia (cambio/restablecimiento) este token
    // deja de valer aunque su `iat` sea del mismo segundo que el cambio.
    ph: huellaPassword(opciones?.passwordHash),
  })
    .setProtectedHeader({ alg: ALGORITMO })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${DURACION_HORAS}h`)
    .sign(aBytes(secreto));
}

/**
 * Verifica un token de sesión según el modo activo y devuelve el usuario, su
 * `iat` (Unix seconds) y la huella `ph` del hash de contraseña con la que se
 * emitió. El caller compara ambos contra la fila actual para invalidar
 * sesiones anteriores a un cambio de contraseña.
 */
export async function verificarTokenSesion(
  token: string,
): Promise<{ usuarioId: string; iat: number; huella: string | undefined }> {
  const { payload } = await jwtVerify(token, aBytes(secretoJwt()), {
    algorithms: [ALGORITMO],
    issuer: ISSUER,
    audience: AUDIENCE,
  });
  if (!payload.sub) {
    throw new Error('Token sin subject (sub)');
  }
  return {
    usuarioId: payload.sub,
    iat: typeof payload.iat === 'number' ? payload.iat : 0,
    huella: typeof payload.ph === 'string' ? payload.ph : undefined,
  };
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
