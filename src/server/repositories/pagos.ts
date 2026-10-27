/**
 * Repositorio de pagos y su detalle — acceso a datos con contexto de tenant.
 *
 * Transacciones (spec §6): crear un pago con sus líneas y cambiar su estado
 * (que puede liberar líneas) son operaciones multi-tabla SIEMPRE en
 * transacción. El estado de los pagos solo cambia por estas vías.
 */
import { and, asc, desc, eq, gte, ilike, inArray, lte, or, sql, type SQL } from 'drizzle-orm';

import { db } from '../db/client';
import { pagoDetalle, pagos } from '../db/schema';
import type { ContextoTenant } from '../middleware/auth';
import type { Cursor } from '../../shared/paginacion';
import { cursorMenor } from './cursor';

export type EstadoTransicion = 'verificado' | 'rechazado';

export type LineaNueva = {
  afiliadoId: string;
  concepto: string;
  fechaCobertura: string;
  monto: string;
};

export type PagoNuevo = {
  montoTotal: string;
  facturaTipoDocumento: string;
  facturaDocumento: string;
  facturaNombre: string;
  facturaCelular?: string | null | undefined;
  facturaCorreo?: string | null | undefined;
  observaciones?: string | null | undefined;
  urlComprobante?: string | null | undefined;
};

export type FiltrosPagos = {
  estado?: string | undefined;
  afiliado?: string | undefined;
  /** AAAA-MM-DD sobre created_at. */
  desde?: string | undefined;
  hasta?: string | undefined;
  /** Texto parcial sobre factura_nombre o factura_documento. */
  factura?: string | undefined;
  /** AAAA-MM-DD sobre revisado_en. */
  revisadoDesde?: string | undefined;
  revisadoHasta?: string | undefined;
  cursor?: Cursor | undefined;
  limit: number;
};

/** Inicio del día (00:00 BOG) como instante UTC. */
function inicioDiaBo(fecha: string): Date {
  return new Date(`${fecha}T05:00:00Z`);
}

/** Fin del día (23:59:59.999 BOG) como instante UTC — inclusivo. */
function finDiaBo(fecha: string): Date {
  const limite = new Date(`${fecha}T00:00:00Z`);
  limite.setUTCDate(limite.getUTCDate() + 1);
  limite.setUTCHours(4, 59, 59, 999);
  return limite;
}

function condicionesListado(filtros: FiltrosPagos): (SQL | undefined)[] {
  const condiciones: (SQL | undefined)[] = [];
  if (filtros.estado) condiciones.push(eq(pagos.estado, filtros.estado));
  if (filtros.desde) condiciones.push(gte(pagos.createdAt, inicioDiaBo(filtros.desde)));
  if (filtros.hasta) condiciones.push(lte(pagos.createdAt, finDiaBo(filtros.hasta)));
  if (filtros.factura) {
    const patron = `%${filtros.factura.replace(/[\\%_]/g, '\\$&')}%`;
    condiciones.push(or(ilike(pagos.facturaNombre, patron), ilike(pagos.facturaDocumento, patron)));
  }
  if (filtros.revisadoDesde) condiciones.push(gte(pagos.revisadoEn, inicioDiaBo(filtros.revisadoDesde)));
  if (filtros.revisadoHasta) condiciones.push(lte(pagos.revisadoEn, finDiaBo(filtros.revisadoHasta)));
  if (filtros.cursor) condiciones.push(cursorMenor(pagos.createdAt, pagos.id, filtros.cursor));
  return condiciones;
}

export async function listarPagos(
  ctx: ContextoTenant,
  filtros: FiltrosPagos,
): Promise<(typeof pagos.$inferSelect)[]> {
  const condiciones: (SQL | undefined)[] = [eq(pagos.organizacionId, ctx.organizacionId)];
  if (filtros.afiliado) {
    // Un pago pertenece al afiliado si tiene al menos una línea con él.
    condiciones.push(
      sql`exists (
        select 1 from ${pagoDetalle} pd
        where pd.pago_id = ${pagos.id}
          and pd.organizacion_id = ${pagos.organizacionId}
          and pd.afiliado_id = ${filtros.afiliado}
      )`,
    );
  }
  condiciones.push(...condicionesListado(filtros));
  return db
    .select()
    .from(pagos)
    .where(and(...condiciones))
    .orderBy(desc(pagos.createdAt), desc(pagos.id))
    .limit(filtros.limit);
}

export async function obtenerPago(
  ctx: ContextoTenant,
  id: string,
): Promise<(typeof pagos.$inferSelect) | undefined> {
  const [fila] = await db
    .select()
    .from(pagos)
    .where(and(eq(pagos.id, id), eq(pagos.organizacionId, ctx.organizacionId)))
    .limit(1);
  return fila;
}

export async function listarLineas(ctx: ContextoTenant, pagoId: string): Promise<(typeof pagoDetalle.$inferSelect)[]> {
  return db
    .select()
    .from(pagoDetalle)
    .where(and(eq(pagoDetalle.pagoId, pagoId), eq(pagoDetalle.organizacionId, ctx.organizacionId)))
    .orderBy(asc(pagoDetalle.fechaCobertura), asc(pagoDetalle.concepto), asc(pagoDetalle.afiliadoId));
}

/** Crea pago + líneas en UNA transacción. Lanza el error PG original (23503/23505/23514). */
export async function crearPago(
  ctx: ContextoTenant,
  pago: PagoNuevo,
  lineas: LineaNueva[],
): Promise<string> {
  return db.transaction(async (tx) => {
    const filas = await tx
      .insert(pagos)
      .values({ organizacionId: ctx.organizacionId, estado: 'pendiente', ...pago })
      .returning({ id: pagos.id });
    const fila = filas[0];
    if (!fila) throw new Error('No se pudo crear el pago'); // no debería pasar: insert con returning

    if (lineas.length > 0) {
      await tx.insert(pagoDetalle).values(
        lineas.map((linea) => ({
          organizacionId: ctx.organizacionId,
          pagoId: fila.id,
          ...linea,
        })),
      );
    }
    return fila.id;
  });
}

/** ¿Existen ya líneas de estos (afiliado, concepto, fecha) en la organización? */
export async function existenLineas(
  ctx: ContextoTenant,
  lineas: LineaNueva[],
): Promise<boolean> {
  const llaves = lineas.map((l) => `${l.afiliadoId}|${l.concepto}|${l.fechaCobertura}`);
  const filas = await db
    .select({ llave: sql<string>`${pagoDetalle.afiliadoId} || '|' || ${pagoDetalle.concepto} || '|' || ${pagoDetalle.fechaCobertura}` })
    .from(pagoDetalle)
    .where(
      and(
        eq(pagoDetalle.organizacionId, ctx.organizacionId),
        inArray(
          pagoDetalle.afiliadoId,
          lineas.map((l) => l.afiliadoId),
        ),
      ),
    );
  return filas.some((f) => llaves.includes(f.llave));
}

/**
 * Transición de estado (§8.1.4–5): siempre en transacción con el pago
 * bloqueado (FOR UPDATE). Rechazar BORRA sus líneas para liberar el mes.
 * El caller valida la transición permitida; acá solo se ejecuta.
 */
export async function aplicarEstadoPago(
  ctx: ContextoTenant,
  id: string,
  estado: EstadoTransicion,
  revisadoPor: string,
): Promise<(typeof pagos.$inferSelect)[]> {
  return db.transaction(async (tx) => {
    await tx
      .select({ id: pagos.id })
      .from(pagos)
      .where(and(eq(pagos.id, id), eq(pagos.organizacionId, ctx.organizacionId)))
      .for('update');

    const actualizadas = await tx
      .update(pagos)
      .set({ estado, revisadoPor, revisadoEn: new Date() })
      .where(and(eq(pagos.id, id), eq(pagos.organizacionId, ctx.organizacionId)))
      .returning();

    if (estado === 'rechazado' && actualizadas.length > 0) {
      await tx
        .delete(pagoDetalle)
        .where(and(eq(pagoDetalle.pagoId, id), eq(pagoDetalle.organizacionId, ctx.organizacionId)));
    }
    return actualizadas;
  });
}

/**
 * Meses 'AAAA-MM' con línea de MENSUALIDAD en pago VERIFICADO, por afiliado.
 * Es la entrada de services/estado-pago.ts. Con `afiliadoIds` acota a un
 * listado (página); sin él, toda la organización (dashboard).
 */
export async function mesesPagadosVerificados(
  ctx: ContextoTenant,
  afiliadoIds?: string[],
): Promise<Map<string, Set<string>>> {
  const condiciones: (SQL | undefined)[] = [
    eq(pagoDetalle.organizacionId, ctx.organizacionId),
    eq(pagoDetalle.concepto, 'mensualidad'),
    eq(pagos.estado, 'verificado'),
  ];
  if (afiliadoIds && afiliadoIds.length > 0) {
    condiciones.push(inArray(pagoDetalle.afiliadoId, afiliadoIds));
  } else if (afiliadoIds) {
    // lista vacía: nada que calcular
    return new Map();
  }
  const filas = await db
    .select({
      afiliadoId: pagoDetalle.afiliadoId,
      mes: sql<string>`to_char(${pagoDetalle.fechaCobertura}, 'YYYY-MM')`,
    })
    .from(pagoDetalle)
    .innerJoin(
      pagos,
      and(eq(pagos.id, pagoDetalle.pagoId), eq(pagos.organizacionId, pagoDetalle.organizacionId)),
    )
    .where(and(...condiciones));

  const mapa = new Map<string, Set<string>>();
  for (const fila of filas) {
    const conjunto = mapa.get(fila.afiliadoId) ?? new Set<string>();
    conjunto.add(fila.mes);
    mapa.set(fila.afiliadoId, conjunto);
  }
  return mapa;
}

export async function contarPagosPendientes(ctx: ContextoTenant): Promise<number> {
  const [fila] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(pagos)
    .where(and(eq(pagos.organizacionId, ctx.organizacionId), eq(pagos.estado, 'pendiente')));
  return fila?.total ?? 0;
}

/** Recaudo verificado por mes ('AAAA-MM') desde una fecha de cobertura mínima. */
export async function recaudoPorMes(
  ctx: ContextoTenant,
  desdeFechaCobertura: string,
): Promise<{ mes: string; total: string }[]> {
  return db
    .select({
      mes: sql<string>`to_char(${pagoDetalle.fechaCobertura}, 'YYYY-MM')`,
      total: sql<string>`round(coalesce(sum(${pagoDetalle.monto}), 0), 2)::text`,
    })
    .from(pagoDetalle)
    .innerJoin(
      pagos,
      and(eq(pagos.id, pagoDetalle.pagoId), eq(pagos.organizacionId, pagoDetalle.organizacionId)),
    )
    .where(
      and(
        eq(pagoDetalle.organizacionId, ctx.organizacionId),
        eq(pagos.estado, 'verificado'),
        gte(pagoDetalle.fechaCobertura, sql`${desdeFechaCobertura}::date`),
      ),
    )
    .groupBy(sql`to_char(${pagoDetalle.fechaCobertura}, 'YYYY-MM')`)
    .orderBy(sql`1`);
}
