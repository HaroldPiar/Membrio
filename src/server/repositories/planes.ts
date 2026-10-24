/**
 * Repositorio de planes — único lugar que toca la tabla con Drizzle.
 * Todos los accesos filtran por `organizacion_id` del contexto (spec §5).
 * Borrado físico: nunca (el FK restringe y el histórico se conserva);
 * la baja es lógica vía `activo = false`.
 */
import { and, asc, eq, type SQL } from 'drizzle-orm';

import { db } from '../db/client';
import { planes } from '../db/schema';
import type { ContextoTenant } from '../middleware/auth';
import type { Cursor } from '../../shared/paginacion';
import type { Opcionales } from '../../shared/casing';
import { cursorMayor } from './cursor';

export type DatosPlan = {
  nombre: string;
  valorMensualidad: string;
  valorMatricula: string;
};

export async function listarPlanes(
  ctx: ContextoTenant,
  opciones: { cursor?: Cursor | undefined; limit: number; activo?: boolean | undefined },
): Promise<(typeof planes.$inferSelect)[]> {
  const condiciones: (SQL | undefined)[] = [eq(planes.organizacionId, ctx.organizacionId)];
  if (opciones.activo !== undefined) condiciones.push(eq(planes.activo, opciones.activo));
  if (opciones.cursor) {
    condiciones.push(cursorMayor(planes.nombre, planes.id, opciones.cursor));
  }
  return db
    .select()
    .from(planes)
    .where(and(...condiciones))
    .orderBy(asc(planes.nombre), asc(planes.id))
    .limit(opciones.limit);
}

export async function obtenerPlan(
  ctx: ContextoTenant,
  id: string,
): Promise<(typeof planes.$inferSelect) | undefined> {
  const [fila] = await db
    .select()
    .from(planes)
    .where(and(eq(planes.id, id), eq(planes.organizacionId, ctx.organizacionId)))
    .limit(1);
  return fila;
}

export async function crearPlan(
  ctx: ContextoTenant,
  datos: DatosPlan,
): Promise<(typeof planes.$inferSelect)[]> {
  return db
    .insert(planes)
    .values({ organizacionId: ctx.organizacionId, ...datos })
    .returning();
}

export async function actualizarPlan(
  ctx: ContextoTenant,
  id: string,
  parcial: Opcionales<DatosPlan>,
): Promise<(typeof planes.$inferSelect)[]> {
  return db
    .update(planes)
    .set(parcial)
    .where(and(eq(planes.id, id), eq(planes.organizacionId, ctx.organizacionId)))
    .returning();
}

/** Baja lógica (nunca DELETE: conserva el histórico de pagos del plan). */
export async function desactivarPlan(
  ctx: ContextoTenant,
  id: string,
): Promise<(typeof planes.$inferSelect)[]> {
  return db
    .update(planes)
    .set({ activo: false })
    .where(and(eq(planes.id, id), eq(planes.organizacionId, ctx.organizacionId)))
    .returning();
}
