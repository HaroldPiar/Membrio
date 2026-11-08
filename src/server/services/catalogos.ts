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
import { generarContrasenaTemporal, hashPassword } from '../auth/password';
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
): Promise<{ usuario: Awaited<ReturnType<typeof obtenerUsuario>>; contrasenaTemporal: string }> {
  const rolId = await reposUsuarios.obtenerRolPorNombre(datos.rol);
  if (rolId === undefined) {
    throw new AppError(422, 'REFERENCIA_INVALIDA', `Rol desconocido: ${datos.rol}`);
  }
  // Alta con password temporal: el admin no elige la contrasena; el sistema la
  // genera y se entrega UNA sola vez. El usuario debe cambiarla (flag en true).
  const contrasenaTemporal = generarContrasenaTemporal();
  const hash = hashPassword(contrasenaTemporal);
  const ahora = new Date();
  const [usuario] = await reposUsuarios.crearUsuario(ctx, {
    correo: datos.correo,
    nombre: datos.nombre,
    rolId,
    passwordHash: hash,
    debeCambiarPassword: true,
    passwordChangedAt: ahora,
  });
  if (!usuario) throw new AppError(500, 'ERROR_INTERNO', 'No se pudo crear el usuario');
  const creado = await obtenerUsuario(ctx, usuario.id);
  if (!creado) throw new AppError(500, 'ERROR_INTERNO', 'No se pudo crear el usuario');
  return { usuario: creado, contrasenaTemporal };
}

/**
 * Restablece la contraseña de un usuario (admin): genera una temporal, guarda el
 * hash, marca debe_cambiar_password y actualiza password_changed_at; devuelve la
 * temporal UNA sola vez. Cierra de facto las sesiones previas del usuario (el
 * caller invalida por iat contra password_changed_at).
 */
export async function restablecerPassword(ctx: ContextoTenant, id: string): Promise<string> {
  const usuario = await obtenerUsuario(ctx, id);
  if (!usuario) throw new AppError(404, 'NO_ENCONTRADO', 'Usuario no encontrado');
  const contrasenaTemporal = generarContrasenaTemporal();
  const hash = hashPassword(contrasenaTemporal);
  const ahora = new Date();
  const [actualizado] = await reposUsuarios.actualizarPasswordDeUsuario(ctx, id, {
    passwordHash: hash,
    debeCambiarPassword: true,
    passwordChangedAt: ahora,
  });
  if (!actualizado) throw new AppError(500, 'ERROR_INTERNO', 'No se pudo actualizar la contraseña');
  return contrasenaTemporal;
}

export async function actualizarUsuario(
  ctx: ContextoTenant,
  id: string,
  parcial: { nombre?: string | undefined; rol?: string | undefined; activo?: boolean | undefined },
) {
  // Existe en el tenant → 404 antes de cualquier escritura.
  const usuarioActual = await obtenerUsuario(ctx, id);
  if (!usuarioActual) throw noEncontrado('Usuario');
  // Autodesactivación prohibida: dejaría la organización sin admins.
  if (parcial.activo === false && id === ctx.usuarioId) {
    throw new AppError(409, 'ESTADO_INVALIDO', 'No puede desactivar su propia cuenta');
  }
  // No se puede quitar el rol admin a sí mismo (autodegradarse a operador).
  if (parcial.rol === 'operador' && id === ctx.usuarioId) {
    throw new AppError(409, 'ESTADO_INVALIDO', 'No puede quitarse el rol admin a sí mismo');
  }
  // No se puede dejar la organización sin ningún admin activo.
  if (parcial.activo === false || parcial.rol === 'operador') {
    const eraAdminActivo = usuarioActual.rol === 'admin' && usuarioActual.activo;
    if (eraAdminActivo) {
      const otrosAdminsActivos = await reposUsuarios.contarOtrosAdminsActivos(ctx, id);
      if (otrosAdminsActivos === 0) {
        throw new AppError(409, 'ESTADO_INVALIDO', 'No puede dejar la organización sin ningún admin activo');
      }
    }
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
