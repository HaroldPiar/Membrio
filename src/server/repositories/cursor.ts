/**
 * Predicados de cursor para paginación (spec §9: limit + cursor).
 * Fila-comparación de (clave, id): estable ante empates de la clave.
 * La clave viaja como string (text o ISO para timestamptz); PG infiere el
 * tipo de cada parámetro desde la columna de la izquierda.
 */
import { sql, type SQL, type SQLWrapper } from 'drizzle-orm';

import type { Cursor } from '../../shared/paginacion';

/** (clave, id) > cursor — orden ASC. */
export function cursorMayor(clave: SQLWrapper, id: SQLWrapper, cursor: Cursor): SQL {
  return sql`(${clave}, ${id}) > (${cursor.clave}, ${cursor.id})`;
}

/** (clave, id) < cursor — orden DESC (listados por fecha de creación). */
export function cursorMenor(clave: SQLWrapper, id: SQLWrapper, cursor: Cursor): SQL {
  return sql`(${clave}, ${id}) < (${cursor.clave}, ${cursor.id})`;
}
