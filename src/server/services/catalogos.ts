/**
 * Servicios de catálogos: planes, categorías, eps y usuarios (capa services:
 * reglas y transacciones — acá solo reglas simples de existencia/permiso;
 * la autorización por rol vive en el middleware de cada ruta, §4).
 *
 * Regla cross-tenant (spec §5.4): todo recurso que no aparece filtrado por
 * `organizacion_id` responde 404, nunca 403.
 */
import { noEncontrado, AppError } from '../errors';
import type { ContextoTenant } from '../middleware/auth';
import * as reposCategorias from '../repositories/categorias';
import * as reposEps from '../repositories/eps';
import * as reposPlanes from '../repositories/planes';
import * as reposUsuarios from '../repositories/usuarios';
import type { Cursor } from '../../shared/paginacion';
import type { Opcionales } from '../../shared/casing';

export type OpcionesListado = { cursor?: Cursor | undefined; limit: number };

// ---------------------------------------------------------------------------
// Planes
// ---------------------------------------------------------------------------

export function listarPlanes(
  ctx: ContextoTenant,
  opciones: OpcionesListado & { activo?: boolean | undefined },
) {
  return reposPlanes.listarPlanes(ctx, opciones);
}

export async function obtenerPlan(ctx: ContextoTenant, id: string) {
  const plan = await reposPlanes.obtenerPlan(ctx, id);
  if (!plan) throw noEncontrado('Plan');
  return plan;
}

export async function crearPlan(ctx: ContextoTenant, datos: reposPlanes.DatosPlan) {
  // Nombre único por organización: 23505 → 409 DUPLICADO (manejado global).
  const [plan] = await reposPlanes.crearPlan(ctx, datos);
  if (!plan) throw new AppError(500, 'ERROR_INTERNO', 'No se pudo crear el plan');
  return plan;
}

export async function actualizarPlan(
  ctx: ContextoTenant,
  id: string,
  parcial: Opcionales<reposPlanes.DatosPlan>,
) {
  const [plan] = await reposPlanes.actualizarPlan(ctx, id, parcial);
  if (!plan) throw noEncontrado('Plan');
  return plan;
}

export async function desactivarPlan(ctx: ContextoTenant, id: string) {
  // Baja lógica: el histórico de pagos conserva el plan referenciado.
  const [plan] = await reposPlanes.desactivarPlan(ctx, id);
  if (!plan) throw noEncontrado('Plan');
  return plan;
}

// ---------------------------------------------------------------------------
// Categorías
// ---------------------------------------------------------------------------

export function listarCategorias(
  ctx: ContextoTenant,
  opciones: OpcionesListado & { activa?: boolean | undefined },
) {
  return reposCategorias.listarCategorias(ctx, opciones);
}

export async function obtenerCategoria(ctx: ContextoTenant, id: string) {
  const categoria = await reposCategorias.obtenerCategoria(ctx, id);
  if (!categoria) throw noEncontrado('Categoría');
  return categoria;
}

export async function crearCategoria(ctx: ContextoTenant, datos: { nombre: string }) {
  const [categoria] = await reposCategorias.crearCategoria(ctx, datos);
  if (!categoria) throw new AppError(500, 'ERROR_INTERNO', 'No se pudo crear la categoría');
  return categoria;
}

export async function actualizarCategoria(
  ctx: ContextoTenant,
  id: string,
  parcial: { nombre?: string | undefined },
) {
  const [categoria] = await reposCategorias.actualizarCategoria(ctx, id, parcial);
  if (!categoria) throw noEncontrado('Categoría');
  return categoria;
}

export async function desactivarCategoria(ctx: ContextoTenant, id: string) {
  const [categoria] = await reposCategorias.desactivarCategoria(ctx, id);
  if (!categoria) throw noEncontrado('Categoría');
  return categoria;
}

// ---------------------------------------------------------------------------
// EPS (catálogo global — sin contexto de tenant)
// ---------------------------------------------------------------------------

export function listarEps(opciones: { activa?: boolean | undefined } = {}) {
  return reposEps.listarEps(opciones);
}

// ---------------------------------------------------------------------------
// Usuarios (solo admin — el rol se exige en la ruta)
// ---------------------------------------------------------------------------

export function listarUsuarios(
  ctx: ContextoTenant,
  opciones: OpcionesListado & { activo?: boolean | undefined },
) {
  return reposUsuarios.listarUsuarios(ctx, opciones);
}

export async function obtenerUsuario(ctx: ContextoTenant, id: string) {
  const usuario = await reposUsuarios.obtenerUsuarioEnOrganizacion(ctx, id);
  if (!usuario) throw noEncontrado('Usuario');
  return usuario;
}

export async function crearUsuario(
  ctx: ContextoTenant,
  datos: { correo: string; nombre: string; rol: string },
) {
  const rolId = await reposUsuarios.obtenerRolPorNombre(datos.rol);
  if (rolId === undefined) {
    throw new AppError(422, 'REFERENCIA_INVALIDA', `Rol desconocido: ${datos.rol}`);
  }
  const [usuario] = await reposUsuarios.crearUsuario(ctx, {
    correo: datos.correo,
    nombre: datos.nombre,
    rolId,
  });
  if (!usuario) throw new AppError(500, 'ERROR_INTERNO', 'No se pudo crear el usuario');
  return obtenerUsuario(ctx, usuario.id);
}

export async function actualizarUsuario(
  ctx: ContextoTenant,
  id: string,
  parcial: { nombre?: string | undefined; rol?: string | undefined; activo?: boolean | undefined },
) {
  // Existe en el tenant → 404 antes de cualquier escritura.
  await obtenerUsuario(ctx, id);
  // Autodesactivación prohibida: dejaría la organización sin admins.
  if (parcial.activo === false && id === ctx.usuarioId) {
    throw new AppError(409, 'ESTADO_INVALIDO', 'No puede desactivar su propia cuenta');
  }
  let rolId: number | undefined;
  if (parcial.rol !== undefined) {
    rolId = await reposUsuarios.obtenerRolPorNombre(parcial.rol);
    if (rolId === undefined) {
      throw new AppError(422, 'REFERENCIA_INVALIDA', `Rol desconocido: ${parcial.rol}`);
    }
  }
  const [usuario] = await reposUsuarios.actualizarUsuario(ctx, id, {
    ...(parcial.nombre !== undefined ? { nombre: parcial.nombre } : {}),
    ...(rolId !== undefined ? { rolId } : {}),
    ...(parcial.activo !== undefined ? { activo: parcial.activo } : {}),
  });
  if (!usuario) throw noEncontrado('Usuario');
  return obtenerUsuario(ctx, usuario.id);
}

/** DELETE /usuarios/:id → baja lógica (activo=false), nunca DELETE físico. */
export function desactivarUsuario(ctx: ContextoTenant, id: string) {
  return actualizarUsuario(ctx, id, { activo: false });
}
