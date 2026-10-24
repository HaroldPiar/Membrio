/**
 * Utilidad para leer el código SQLSTATE de un error de Postgres.
 *
 * Drizzle (y a veces el driver) envuelve el error original: el código vive en
 * `err.cause` (DrizzleQueryError → cause del driver). Recorremos la cadena de
 * causas hasta encontrar un código con forma de SQLSTATE (5 caracteres).
 *
 * Se reutiliza en el manejador de errores de la API (Fase 2) y en scripts.
 */
const SQLSTATE = /^[0-9A-Z]{5}$/;

export function pgCode(err: unknown): string | undefined {
  let actual: unknown = err;

  for (let i = 0; i < 5 && actual != null; i += 1) {
    const code = (actual as { code?: unknown }).code;
    if (typeof code === 'string' && SQLSTATE.test(code)) return code;
    actual = (actual as { cause?: unknown }).cause;
  }

  return undefined;
}
