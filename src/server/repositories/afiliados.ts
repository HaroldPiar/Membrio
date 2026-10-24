/**
 * Repositorio de afiliados — acceso a datos con contexto de tenant (spec §5).
 *
 * Notas:
 *  - `listarAfiliados` con filtro por estado NO pagina en SQL: el estado se
 *    calcula en services y el corte se hace en memoria. Escala del MVP
 *    (Truchas: cientos de filas); si crece, migrar a vista materializada (§8.4).
 *  - `mesesPagadosVerificados` vive en repositories/pagos.ts (es dato de pagos).
 */
import { and, asc, eq, ilike, inArray, or, sql, type SQL } from 'drizzle-orm';

import { db } from '../db/client';
import { afiliados, planes } from '../db/schema';
import type { ContextoTenant } from '../middleware/auth';
import type { Cursor } from '../../shared/paginacion';
import type { Opcionales } from '../../shared/casing';
import { cursorMayor } from './cursor';

export type FiltrosAfiliados = {
  q?: string | undefined;
  activo?: boolean | undefined;
  categoria?: string | undefined;
  plan?: string | undefined;
  cursor?: Cursor | undefined;
  limit: number;
  /** true = traer todas las filas que cumplan los filtros de SQL (el corte lo hace el service). */
  sinLimiteSQL?: boolean | undefined;
};

export type DatosAfiliado = Omit<
  typeof afiliados.$inferInsert,
  'id' | 'organizacionId' | 'fechaRetiro' | 'motivoRetiro' | 'activo' | 'createdAt' | 'updatedAt'
>;

function condicionesListado(filtros: FiltrosAfiliados): (SQL | undefined)[] {
  const condiciones: (SQL | undefined)[] = [];
  if (filtros.q) {
    const patron = `%${filtros.q.replace(/[\\%_]/g, '\\$&')}%`;
    condiciones.push(
      or(ilike(afiliados.nombre, patron), ilike(afiliados.numeroDocumento, patron)),
    );
  }
  if (filtros.activo !== undefined) condiciones.push(eq(afiliados.activo, filtros.activo));
  if (filtros.categoria) condiciones.push(eq(afiliados.categoriaId, filtros.categoria));
  if (filtros.plan) condiciones.push(eq(afiliados.planId, filtros.plan));
  if (filtros.cursor) condiciones.push(cursorMayor(afiliados.nombre, afiliados.id, filtros.cursor));
  return condiciones;
}

export async function listarAfiliados(
  ctx: ContextoTenant,
  filtros: FiltrosAfiliados,
): Promise<(typeof afiliados.$inferSelect)[]> {
  const condiciones = [
    eq(afiliados.organizacionId, ctx.organizacionId),
    ...condicionesListado(filtros),
  ];
  return db
    .select()
    .from(afiliados)
    .where(and(...condiciones))
    .orderBy(asc(afiliados.nombre), asc(afiliados.id))
    .limit(filtros.sinLimiteSQL ? 5000 : filtros.limit);
}

export async function obtenerAfiliado(
  ctx: ContextoTenant,
  id: string,
): Promise<(typeof afiliados.$inferSelect) | undefined> {
  const [fila] = await db
    .select()
    .from(afiliados)
    .where(and(eq(afiliados.id, id), eq(afiliados.organizacionId, ctx.organizacionId)))
    .limit(1);
  return fila;
}

export async function crearAfiliado(
  ctx: ContextoTenant,
  datos: DatosAfiliado,
): Promise<(typeof afiliados.$inferSelect)[]> {
  return db.insert(afiliados).values({ organizacionId: ctx.organizacionId, ...datos }).returning();
}

export async function actualizarAfiliado(
  ctx: ContextoTenant,
  id: string,
  parcial: Opcionales<DatosAfiliado>,
): Promise<(typeof afiliados.$inferSelect)[]> {
  return db
    .update(afiliados)
    .set(parcial)
    .where(and(eq(afiliados.id, id), eq(afiliados.organizacionId, ctx.organizacionId)))
    .returning();
}

/**
 * Retiro lógico (§8.5): una sola escritura con activo=false + fecha + motivo.
 * Solo actualiza si sigue activo (el caller ya validó el estado previo).
 */
export async function retirarAfiliado(
  ctx: ContextoTenant,
  id: string,
  datos: { fechaRetiro: string; motivoRetiro?: string | null },
): Promise<(typeof afiliados.$inferSelect)[]> {
  return db
    .update(afiliados)
    .set({ activo: false, fechaRetiro: datos.fechaRetiro, motivoRetiro: datos.motivoRetiro ?? null })
    .where(
      and(eq(afiliados.id, id), eq(afiliados.organizacionId, ctx.organizacionId), eq(afiliados.activo, true)),
    )
    .returning();
}

/** Subconjunto de `ids` que existen en la organización (validación de pertenencia en pagos). */
export async function idsExistentes(ctx: ContextoTenant, ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const filas = await db
    .select({ id: afiliados.id })
    .from(afiliados)
    .where(and(eq(afiliados.organizacionId, ctx.organizacionId), inArray(afiliados.id, ids)));
  return new Set(filas.map((f) => f.id));
}

/** Conteo por `activo` (dashboard: total vs retirados). */
export async function contarPorActivo(ctx: ContextoTenant): Promise<{ activos: number; retirados: number }> {
  const filas = await db
    .select({ activo: afiliados.activo, total: sql<number>`count(*)::int` })
    .from(afiliados)
    .where(eq(afiliados.organizacionId, ctx.organizacionId))
    .groupBy(afiliados.activo);
  let activos = 0;
  let retirados = 0;
  for (const fila of filas) {
    if (fila.activo) activos = fila.total;
    else retirados = fila.total;
  }
  return { activos, retirados };
}

/**
 * Afiliados activos con los datos que necesita el estado de pago y la
 * cartera: incluye valor_mensualidad y descuento del plan (join por la
 * FK compuesta (plan_id, organizacion_id)).
 */
export async function listarActivosParaEstado(ctx: ContextoTenant): Promise<
  {
    id: string;
    nombre: string;
    planId: string;
    categoriaId: string;
    fechaIngreso: string;
    descuento: string;
    valorMensualidad: string;
  }[]
> {
  return db
    .select({
      id: afiliados.id,
      nombre: afiliados.nombre,
      planId: afiliados.planId,
      categoriaId: afiliados.categoriaId,
      fechaIngreso: afiliados.fechaIngreso,
      descuento: afiliados.descuento,
      valorMensualidad: planes.valorMensualidad,
    })
    .from(afiliados)
    .innerJoin(
      planes,
      and(eq(planes.id, afiliados.planId), eq(planes.organizacionId, afiliados.organizacionId)),
    )
    .where(and(eq(afiliados.organizacionId, ctx.organizacionId), eq(afiliados.activo, true)))
    .orderBy(asc(afiliados.nombre));
}
