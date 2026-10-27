/**
 * Servicio de afiliados: CRUD, retiro y cálculo de estado de pago por fila.
 * El estado NUNCA se guarda: se deriva con services/estado-pago.ts (§8.3).
 */
import { AppError, noEncontrado } from '../errors';
import type { ContextoTenant } from '../middleware/auth';
import * as reposAfiliados from '../repositories/afiliados';
import type { DireccionOrden, OrdenAfiliado } from '../repositories/afiliados';
import { mesesPagadosVerificados } from '../repositories/pagos';
import type { EstadoPagoCalculado, ResultadoEstado } from './estado-pago';
import { calcularEstadoPago, hoyEnZona } from './estado-pago';
import type { Opcionales } from '../../shared/casing';

export type AfiliadoConEstado<T> = T & { estado_pago: EstadoPagoCalculado | null };

/**
 * Estado para un lote de afiliados con UNA consulta de meses pagados.
 * Un afiliado retirado (activo=false) queda en null.
 */
export async function estadosDe(
  ctx: ContextoTenant,
  filas: { id: string; fechaIngreso: string; activo: boolean }[],
  hoy: Date = new Date(),
): Promise<Map<string, ResultadoEstado | null>> {
  const meses = await mesesPagadosVerificados(
    ctx,
    filas.map((f) => f.id),
  );
  const resultado = new Map<string, ResultadoEstado | null>();
  for (const fila of filas) {
    resultado.set(
      fila.id,
      calcularEstadoPago(
        {
          fechaIngreso: fila.fechaIngreso,
          activo: fila.activo,
          mesesPagados: meses.get(fila.id) ?? new Set<string>(),
        },
        hoy,
      ),
    );
  }
  return resultado;
}

export type FiltrosListado = {
  q?: string | undefined;
  activo?: boolean | undefined;
  categoria?: string | undefined;
  plan?: string | undefined;
  estado_pago?: EstadoPagoCalculado | undefined;
  orden?: OrdenAfiliado | undefined;
  direccion?: DireccionOrden | undefined;
  cursor?: { clave: string; id: string } | undefined;
  limit: number;
};

/** Clave de orden del row: nombre (por defecto) o número de documento. */
function claveDeOrden(fila: FilaListado, orden: OrdenAfiliado | undefined): string {
  return orden === 'documento' ? fila.numeroDocumento : fila.nombre;
}

/** ¿La fila queda DESPUÉS del cursor en el orden (campo, id) aplicado? */
function esPosteriorAlCursor(
  fila: FilaListado,
  cursor: { clave: string; id: string },
  orden: OrdenAfiliado | undefined,
  descendente: boolean,
): boolean {
  const clave = claveDeOrden(fila, orden);
  const cmpClave = clave < cursor.clave ? -1 : clave > cursor.clave ? 1 : 0;
  const cmp = cmpClave !== 0 ? cmpClave : fila.id < cursor.id ? -1 : fila.id > cursor.id ? 1 : 0;
  return descendente ? cmp < 0 : cmp > 0;
}

export type FilaListado = Awaited<ReturnType<typeof reposAfiliados.listarAfiliados>>[number];
export type FilaConEstado = FilaListado & { estado_pago: EstadoPagoCalculado | null };

/**
 * Listado con filtros (spec §9) y estado calculado por fila.
 * Con `estado_pago` el filtro se aplica sobre el estado CALCULADO: se traen
 * las filas de SQL y el corte de página se hace en memoria (escala MVP;
 * ver repositories/afiliados.ts).
 */
export async function listarAfiliados(
  ctx: ContextoTenant,
  filtros: FiltrosListado,
): Promise<FilaConEstado[]> {
  const hoy = new Date();
  if (filtros.estado_pago) {
    const { cursor: _sinCursor, ...base } = filtros;
    void _sinCursor;
    const filas = await reposAfiliados.listarAfiliados(ctx, {
      ...base,
      limit: 5000,
      sinLimiteSQL: true,
      activo: true, // el estado solo se evalúa sobre activos (§8.3)
    });
    const estados = await estadosDe(ctx, filas, hoy);
    const cumplen = filas.filter((f) => estados.get(f.id)?.estado === filtros.estado_pago);
    // Cursor sobre el orden (campo, id) ya aplicado por SQL.
    const cursor = filtros.cursor;
    const descendente = filtros.direccion === 'desc';
    const desde = cursor
      ? cumplen.findIndex((f) => esPosteriorAlCursor(f, cursor, filtros.orden, descendente))
      : 0;
    const inicio = desde >= 0 ? desde : cumplen.length;
    return cumplen.slice(inicio, inicio + filtros.limit).map((f) => ({
      ...f,
      estado_pago: estados.get(f.id)?.estado ?? null,
    }));
  }
  const filas = await reposAfiliados.listarAfiliados(ctx, filtros);
  const estados = await estadosDe(ctx, filas, hoy);
  return filas.map((f) => ({ ...f, estado_pago: estados.get(f.id)?.estado ?? null }));
}

export async function obtenerAfiliado(ctx: ContextoTenant, id: string) {
  const afiliado = await reposAfiliados.obtenerAfiliado(ctx, id);
  if (!afiliado) throw noEncontrado('Afiliado');
  const [estado] = (await estadosDe(ctx, [afiliado])).values();
  return { ...afiliado, estado_pago: estado?.estado ?? null };
}

/** Adjunta estado_pago calculado a una fila (respuestas de detalle). */
async function conEstado<T extends { id: string; fechaIngreso: string; activo: boolean }>(
  ctx: ContextoTenant,
  fila: T,
): Promise<T & { estado_pago: EstadoPagoCalculado | null }> {
  const [estado] = (await estadosDe(ctx, [fila])).values();
  return { ...fila, estado_pago: estado?.estado ?? null };
}

export async function crearAfiliado(
  ctx: ContextoTenant,
  datos: reposAfiliados.DatosAfiliado,
) {
  // plan_id/categoria_id ajenos → FK compuesta falla → 422 (nunca 403/404
  // parcial: la API responde referencia inválida, sin filtrar existencia).
  const [afiliado] = await reposAfiliados.crearAfiliado(ctx, datos);
  if (!afiliado) throw new AppError(500, 'ERROR_INTERNO', 'No se pudo crear el afiliado');
  return conEstado(ctx, afiliado);
}

export async function actualizarAfiliado(
  ctx: ContextoTenant,
  id: string,
  parcial: Opcionales<reposAfiliados.DatosAfiliado>,
) {
  const [afiliado] = await reposAfiliados.actualizarAfiliado(ctx, id, parcial);
  if (!afiliado) throw noEncontrado('Afiliado');
  return conEstado(ctx, afiliado);
}

/**
 * Retiro lógico (§8.5): activo=false + fecha + motivo en una sola escritura.
 * No hay borrado físico; un afiliado ya retirado responde 409.
 */
export async function retirarAfiliado(
  ctx: ContextoTenant,
  id: string,
  datos: { fecha_retiro?: string | undefined; motivo_retiro?: string | undefined },
) {
  const existente = await reposAfiliados.obtenerAfiliado(ctx, id);
  if (!existente) throw noEncontrado('Afiliado');
  if (!existente.activo) {
    throw new AppError(409, 'ESTADO_INVALIDO', 'El afiliado ya está retirado');
  }
  const [retirado] = await reposAfiliados.retirarAfiliado(ctx, id, {
    fechaRetiro: datos.fecha_retiro ?? hoyEnZona(new Date()),
    motivoRetiro: datos.motivo_retiro ?? null,
  });
  if (!retirado) throw noEncontrado('Afiliado');
  return { ...retirado, estado_pago: null };
}
