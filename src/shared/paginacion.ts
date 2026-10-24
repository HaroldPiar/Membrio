/**
 * Paginación por `limit` + `cursor` (spec §9: máximo 100 por página).
 *
 * El cursor es opaco: base64url de JSON { clave, id } donde `clave` es el
 * valor de orden (nombre) de la última fila de la página. El repositorio
 * aplica el predicado estricto (clave, id) > (cursor.clave, cursor.id) con
 * orden (clave ASC, id ASC), estable ante empates.
 */
import { z } from '@hono/zod-openapi';

export const LIMITE_MAXIMO = 100;

export const paginacionQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(LIMITE_MAXIMO).default(20).openapi({
    example: 20,
    description: `Cantidad de ítems por página (máx ${LIMITE_MAXIMO})`,
  }),
  cursor: z.string().min(1).optional().openapi({
    example: 'eyJjbGF2ZSI6IkFSSUEiLCJpZCI6IjNhOCJ9',
    description: 'Cursor opaco devuelto en paginacion.cursor_siguiente de la página anterior',
  }),
});

export type PaginacionQuery = z.infer<typeof paginacionQuerySchema>;

export type Cursor = { clave: string; id: string };

export function codificarCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function decodificarCursor(cursor: string | undefined): Cursor | undefined {
  if (!cursor) return undefined;
  try {
    const dato = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as unknown;
    if (
      typeof dato === 'object' &&
      dato !== null &&
      typeof (dato as Cursor).clave === 'string' &&
      typeof (dato as Cursor).id === 'string'
    ) {
      return dato as Cursor;
    }
  } catch {
    // cursor ilegible: se trata como ausente (primera página)
  }
  return undefined;
}

/** Devuelve `limit + 1` filas para saber si hay página siguiente. */
export function limiteConDetras(limit: number): number {
  return Math.min(limit + 1, LIMITE_MAXIMO + 1);
}

export type RespuestaPaginada<D> = {
  datos: D[];
  paginacion: {
    limit: number;
    cursor_siguiente: string | null;
  };
};

/** Esquema de respuesta paginada para documentación OpenAPI. */
export function respuestaPaginadaSchema<D extends z.ZodTypeAny>(dato: D) {
  return z.object({
    datos: z.array(dato),
    paginacion: z.object({
      limit: z.number().openapi({ example: 20 }),
      cursor_siguiente: z.string().nullable().openapi({
        description: 'Cursor para la página siguiente; null si no hay más',
      }),
    }),
  });
}

/**
 * Corta el exceso de la sonda (limit+1) y arma la respuesta.
 * `claveDe` extrae el valor de orden de la última fila devuelta.
 */
export function paginar<D extends { id: string }>(
  filas: D[],
  limit: number,
  claveDe: (fila: D) => string,
): RespuestaPaginada<D> {
  const haySiguiente = filas.length > limit;
  const datos = haySiguiente ? filas.slice(0, limit) : filas;
  const ultima = datos.at(-1);
  return {
    datos,
    paginacion: {
      limit,
      cursor_siguiente:
        haySiguiente && ultima ? codificarCursor({ clave: claveDe(ultima), id: ultima.id }) : null,
    },
  };
}
