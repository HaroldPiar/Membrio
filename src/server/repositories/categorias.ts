/**
 * Repositorio de categorías (cursos) — acceso a datos con contexto de tenant.
 * Baja lógica: `activa = false` (un curso histórico no se borra).
 */
import { and, asc, eq, type SQL } from 'drizzle-orm';

import { db } from '../db/client';
import { categorias } from '../db/schema';
import type { ContextoTenant } from '../middleware/auth';
import type { Cursor } from '../../shared/paginacion';
import { cursorMayor } from './cursor';

export async function listarCategorias(
  ctx: ContextoTenant,
  opciones: { cursor?: Cursor | undefined; limit: number; activa?: boolean | undefined },
): Promise<(typeof categorias.$inferSelect)[]> {
  const condiciones: (SQL | undefined)[] = [eq(categorias.organizacionId, ctx.organizacionId)];
  if (opciones.activa !== undefined) condiciones.push(eq(categorias.activa, opciones.activa));
  if (opciones.cursor) {
    condiciones.push(cursorMayor(categorias.nombre, categorias.id, opciones.cursor));
  }
  return db
    .select()
    .from(categorias)
    .where(and(...condiciones))
    .orderBy(asc(categorias.nombre), asc(categorias.id))
    .limit(opciones.limit);
}

export async function obtenerCategoria(
  ctx: ContextoTenant,
  id: string,
): Promise<(typeof categorias.$inferSelect) | undefined> {
  const [fila] = await db
    .select()
    .from(categorias)
    .where(and(eq(categorias.id, id), eq(categorias.organizacionId, ctx.organizacionId)))
    .limit(1);
  return fila;
}

export async function crearCategoria(
  ctx: ContextoTenant,
  datos: { nombre: string },
): Promise<(typeof categorias.$inferSelect)[]> {
  return db
    .insert(categorias)
    .values({ organizacionId: ctx.organizacionId, ...datos })
    .returning();
}

export async function actualizarCategoria(
  ctx: ContextoTenant,
  id: string,
  parcial: { nombre?: string | undefined },
): Promise<(typeof categorias.$inferSelect)[]> {
  return db
    .update(categorias)
    .set(parcial)
    .where(and(eq(categorias.id, id), eq(categorias.organizacionId, ctx.organizacionId)))
    .returning();
}

export async function desactivarCategoria(
  ctx: ContextoTenant,
  id: string,
): Promise<(typeof categorias.$inferSelect)[]> {
  return db
    .update(categorias)
    .set({ activa: false })
    .where(and(eq(categorias.id, id), eq(categorias.organizacionId, ctx.organizacionId)))
    .returning();
}
