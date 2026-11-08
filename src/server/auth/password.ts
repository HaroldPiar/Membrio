/**
 * Hashing de contraseñas con `node:crypto` scrypt (sin dependencias nuevas):
 *
 *  - scrypt, N=16384, r=8, p=1, salt de 16 bytes, hash de 64 bytes;
 *  - formato almacenado: `scrypt$<salt b64>$<hash b64>`;
 *  - comparación con `timingSafeEqual`;
 *  - si el usuario no existe o no tiene hash, se verifica contra un hash de
 *    relleno: el tiempo de respuesta no filtra información.
 *
 * Política de contraseña (misma en API y en el script de admin): 12 a 128
 * caracteres (el máximo evita abuso de CPU en scrypt).
 */
import { createHash, randomInt, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const ALGORITMO = 'scrypt';
const KEYLEN = 64;
const SALA_BYTES = 16;
const N = 16384;
const R = 8;
const P = 1;

function derivar(contrasena: string, salt: Buffer): Buffer {
  return scryptSync(contrasena, salt, KEYLEN, { N, r: R, p: P });
}

/** Genera el hash `scrypt$<salt>$<hash>` de una contraseña (para admin/seed/tests). */
export function hashPassword(contrasena: string): string {
  const salt = randomBytes(SALA_BYTES);
  const hash = scryptSync(contrasena, salt, KEYLEN, { N, r: R, p: P });
  return `${ALGORITMO}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

/** Hash de relleno: se compara cuando el usuario no tiene hash (no revelar existencia). */
const HASH_RELLENO = hashPassword('membrio-relleno-no-se-usa');

function iguales(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Verifica una contraseña contra un hash (o contra el de relleno si el usuario
 * no tiene hash). Devuelve false cuando no autoriza.
 */
export function verificarPassword(contrasena: string, hash: string | null | undefined): boolean {
  const hashReal = typeof hash === 'string' && hash.startsWith(`${ALGORITMO}$`);
  const objetivo = hashReal ? hash : HASH_RELLENO;
  const [, saltB64, hashB64] = objetivo.split('$');
  if (!saltB64 || !hashB64) return false;
  const derivado = derivar(contrasena, Buffer.from(saltB64, 'base64'));
  const esperado = Buffer.from(hashB64, 'base64');
  const coincide = iguales(derivado, esperado);
  return hashReal && coincide;
}

/** Valida la política de contraseña: 12 a 128 caracteres. */
export function esContrasenaValida(contrasena: string): boolean {
  return contrasena.length >= 12 && contrasena.length <= 128;
}

const CARACTERES_TEMPORALES = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
const LONGITUD_TEMPORAL = 16;

/**
 * Genera una contraseña temporal de 16 caracteres (alfabeto sin caracteres
 * ambiguos: sin 0/O, 1/l/I) que cumple la política 12–128. Se usa para el alta
 * de usuario admin y el restablecimiento; se entrega UNA sola vez.
 */
export function generarContrasenaTemporal(): string {
  let resultado = '';
  for (let i = 0; i < LONGITUD_TEMPORAL; i += 1) {
    resultado += CARACTERES_TEMPORALES[randomInt(0, CARACTERES_TEMPORALES.length)];
  }
  return resultado;
}

/**
 * Huella estable y no reversible del hash de contraseña, para el claim `ph`
 * del JWT. El `iat` solo tiene granularidad de segundos, así que un token
 * emitido en el mismo segundo que un cambio/restablecimiento seguiría siendo
 * válido; comparar esta huella contra el hash actual cierra ese hueco: si el
 * hash cambió, la huella cambia y el token deja de valer.
 *
 * Se trunca a 16 hex (suficiente para detectar cambios accidentales o
 * provocados) y NUNCA expone el hash scrypt almacenado en la base.
 */
export function huellaPassword(hash: string | null | undefined): string {
  return createHash('sha256')
    .update(hash ?? 'sin-password')
    .digest('hex')
    .slice(0, 16);
}
