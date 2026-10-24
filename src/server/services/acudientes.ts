/**
 * Servicio de acudientes: alta/baja/edición bajo un afiliado del tenant.
 *
 * Principal: al crear o marcar `es_principal=true` se desmarca el principal
 * actual en una segunda escritura (el índice único parcial de la base es la
 * red de seguridad: dos escrituras no transaccionales pueden dejar 0
 * principales si algo falla a mitad de camino, estado recuperable que dos
 * escrituras consecutivas corrigen; pagos y retiro sí exigen transacción).
 */
import { noEncontrado } from '../errors';
import type { ContextoTenant } from '../middleware/auth';
import * as reposAcudientes from '../repositories/acudientes';
import * as reposAfiliados from '../repositories/afiliados';
import type { Opcionales } from '../../shared/casing';

async function afiliadoExigido(ctx: ContextoTenant, afiliadoId: string) {
  const afiliado = await reposAfiliados.obtenerAfiliado(ctx, afiliadoId);
  if (!afiliado) throw noEncontrado('Afiliado');
  return afiliado;
}

export async function listarAcudientes(ctx: ContextoTenant, afiliadoId: string) {
  await afiliadoExigido(ctx, afiliadoId);
  return reposAcudientes.listarAcudientes(ctx, afiliadoId);
}

export async function crearAcudiente(
  ctx: ContextoTenant,
  afiliadoId: string,
  datos: reposAcudientes.DatosAcudiente,
) {
  await afiliadoExigido(ctx, afiliadoId);
  if (datos.esPrincipal) {
    await reposAcudientes.desactivarPrincipales(ctx, afiliadoId);
  }
  const [acudiente] = await reposAcudientes.crearAcudiente(ctx, afiliadoId, datos);
  if (!acudiente) throw noEncontrado('Acudiente');
  return acudiente;
}

export async function actualizarAcudiente(
  ctx: ContextoTenant,
  id: string,
  parcial: Opcionales<reposAcudientes.DatosAcudiente>,
) {
  const existente = await reposAcudientes.obtenerAcudiente(ctx, id);
  if (!existente) throw noEncontrado('Acudiente');
  if (parcial.esPrincipal === true) {
    await reposAcudientes.desactivarPrincipales(ctx, existente.afiliadoId);
  }
  const [acudiente] = await reposAcudientes.actualizarAcudiente(ctx, id, parcial);
  if (!acudiente) throw noEncontrado('Acudiente');
  return acudiente;
}

/**
 * DELETE físico permitido: los pagos no referencian acudientes (el snapshot
 * de facturación vive en `pagos`, §8.1), no hay histórico que conservar acá.
 */
export async function eliminarAcudiente(ctx: ContextoTenant, id: string) {
  const existente = await reposAcudientes.obtenerAcudiente(ctx, id);
  if (!existente) throw noEncontrado('Acudiente');
  await reposAcudientes.eliminarAcudiente(ctx, id);
}
