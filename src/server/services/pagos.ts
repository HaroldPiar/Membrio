/**
 * Servicio de pagos (spec §8.1): creación en transacción con validaciones,
 * y verificación/rechazo con liberación de líneas.
 *
 * Validaciones de FORMA (día 1, matrícula en enero, duplicados internos,
 * monto_total == suma) viven en Zod (src/shared/pagos.ts) y ya corren antes
 * de llegar acá. Acá se agregan las que requieren consultar la base:
 *  - cada afiliado debe pertenecer al tenant → si falta alguno: 404
 *    (indistinguible de "no existe", spec §5.4);
 *  - no puede existir ya una línea para (afiliado, concepto, fecha) → 409.
 */
import { AppError, noEncontrado } from '../errors';
import type { ContextoTenant } from '../middleware/auth';
import * as reposAfiliados from '../repositories/afiliados';
import * as reposPagos from '../repositories/pagos';

export type PagoConLineas = Awaited<ReturnType<typeof obtenerPago>>;

export function listarPagos(ctx: ContextoTenant, filtros: reposPagos.FiltrosPagos) {
  return reposPagos.listarPagos(ctx, filtros);
}

export async function obtenerPago(ctx: ContextoTenant, id: string) {
  const pago = await reposPagos.obtenerPago(ctx, id);
  if (!pago) throw noEncontrado('Pago');
  const lineas = await reposPagos.listarLineas(ctx, id);
  return { ...pago, lineas };
}

export async function crearPago(
  ctx: ContextoTenant,
  datos: reposPagos.PagoNuevo & { lineas: reposPagos.LineaNueva[] },
) {
  const { lineas, ...pago } = datos;

  const ids = [...new Set(lineas.map((l) => l.afiliadoId))];
  const existentes = await reposAfiliados.idsExistentes(ctx, ids);
  if (existentes.size !== ids.length) {
    // Algún afiliado no es de esta organización (o no existe): 404 uniforme.
    throw noEncontrado('Afiliado');
  }

  if (await reposPagos.existenLineas(ctx, lineas)) {
    throw new AppError(
      409,
      'DUPLICADO',
      'Ya existe un pago con una de estas líneas (mismo afiliado, concepto y fecha de cobertura)',
    );
  }

  const id = await reposPagos.crearPago(ctx, pago, lineas);
  return obtenerPago(ctx, id);
}

/**
 * PATCH /pagos/:id/estado (§8.1.4–5).
 * Transiciones permitidas: pendiente → verificado|rechazado,
 * verificado → rechazado. Un pago rechazado no se re-verifica: sus líneas
 * fueron liberadas y la intención correcta es crear un pago nuevo.
 */
export async function cambiarEstadoPago(
  ctx: ContextoTenant,
  id: string,
  estado: 'verificado' | 'rechazado',
) {
  const pago = await reposPagos.obtenerPago(ctx, id);
  if (!pago) throw noEncontrado('Pago');
  if (pago.estado === estado) {
    throw new AppError(409, 'ESTADO_INVALIDO', `El pago ya está en estado "${estado}"`);
  }
  if (pago.estado === 'rechazado') {
    throw new AppError(
      409,
      'ESTADO_INVALIDO',
      'Un pago rechazado no se re-verifica: sus líneas fueron liberadas; registre un pago nuevo',
    );
  }
  await reposPagos.aplicarEstadoPago(ctx, id, estado, ctx.usuarioId);
  return obtenerPago(ctx, id);
}
