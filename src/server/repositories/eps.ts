/**
 * Repositorio de EPS — catálogo GLOBAL sin organizacion_id (spec §7:
 * es información de referencia, no dato del tenant). Solo lectura en el MVP.
 */
import { asc, eq } from 'drizzle-orm';

import { db } from '../db/client';
import { eps } from '../db/schema';

export async function listarEps(
  opciones: { activa?: boolean | undefined } = {},
): Promise<(typeof eps.$inferSelect)[]> {
  const condicion = opciones.activa === undefined ? undefined : eq(eps.activa, opciones.activa);
  return db.select().from(eps).where(condicion).orderBy(asc(eps.nombre));
}
