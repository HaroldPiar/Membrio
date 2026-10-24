/**
 * Repositorio de acudientes — acceso a datos con contexto de tenant.
 * La base NO tiene borrado lógico para acudientes (sin columna activo):
 * DELETE es físico y está permitido (los pagos no referencian acudientes;
 * el snapshot de facturación vive en `pagos`, spec §8.1).
 * El índice único parcial garantiza un solo principal por afiliado.
 */
import { and, asc, eq } from 'drizzle-orm';

import { db } from '../db/client';
import { acudientes } from '../db/schema';
import type { ContextoTenant } from '../middleware/auth';
import type { Opcionales } from '../../shared/casing';

export type DatosAcudiente = {
  numeroDocumento: string;
  nombre: string;
  celular?: string | null | undefined;
  correo?: string | null | undefined;
  esPrincipal: boolean;
};

export async function listarAcudientes(
  ctx: ContextoTenant,
  afiliadoId: string,
): Promise<(typeof acudientes.$inferSelect)[]> {
  return db
    .select()
    .from(acudientes)
    .where(and(eq(acudientes.organizacionId, ctx.organizacionId), eq(acudientes.afiliadoId, afiliadoId)))
    .orderBy(asc(acudientes.nombre), asc(acudientes.id));
}

export async function obtenerAcudiente(
  ctx: ContextoTenant,
  id: string,
): Promise<(typeof acudientes.$inferSelect) | undefined> {
  const [fila] = await db
    .select()
    .from(acudientes)
    .where(and(eq(acudientes.id, id), eq(acudientes.organizacionId, ctx.organizacionId)))
    .limit(1);
  return fila;
}

export async function crearAcudiente(
  ctx: ContextoTenant,
  afiliadoId: string,
  datos: DatosAcudiente,
): Promise<(typeof acudientes.$inferSelect)[]> {
  return db
    .insert(acudientes)
    .values({ organizacionId: ctx.organizacionId, afiliadoId, ...datos })
    .returning();
}

/** Quita la marca de principal a los acudientes actuales del afiliado (transacción del caller). */
export async function desactivarPrincipales(ctx: ContextoTenant, afiliadoId: string): Promise<void> {
  await db
    .update(acudientes)
    .set({ esPrincipal: false })
    .where(
      and(
        eq(acudientes.organizacionId, ctx.organizacionId),
        eq(acudientes.afiliadoId, afiliadoId),
        eq(acudientes.esPrincipal, true),
      ),
    );
}

export async function actualizarAcudiente(
  ctx: ContextoTenant,
  id: string,
  parcial: Opcionales<DatosAcudiente>,
): Promise<(typeof acudientes.$inferSelect)[]> {
  return db
    .update(acudientes)
    .set(parcial)
    .where(and(eq(acudientes.id, id), eq(acudientes.organizacionId, ctx.organizacionId)))
    .returning();
}

export async function eliminarAcudiente(ctx: ContextoTenant, id: string): Promise<boolean> {
  const filas = await db
    .delete(acudientes)
    .where(and(eq(acudientes.id, id), eq(acudientes.organizacionId, ctx.organizacionId)))
    .returning({ id: acudientes.id });
  return filas.length > 0;
}
