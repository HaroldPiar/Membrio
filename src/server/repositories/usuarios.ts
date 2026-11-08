/**
 * Repositorio de usuarios: el ÚNICO lugar que toca la tabla usuarios con Drizzle
 * (regla de capas: routes → services → repositories).
 *
 * Estos lookups son de IDENTIDAD (van antes de existir contexto de tenant):
 * el middleware de auth busca el usuario por el sub del JWT o por el correo
 * del dev-login; de esa fila sale el organizacion_id que SÍ entra al contexto.
 */
import { and, asc, count, eq, ne, type SQL } from 'drizzle-orm';

import { db } from '../db/client';
import { roles, usuarios } from '../db/schema';
import type { ContextoTenant } from '../middleware/auth';
import type { Cursor } from '../../shared/paginacion';
import { cursorMayor } from './cursor';

export type UsuarioSesion = {
  id: string;
  organizacionId: string;
  correo: string;
  nombre: string;
  activo: boolean;
  /** Hash scrypt de la contraseña (solo en AUTH_MODE=password; null en dev/seed). */
  passwordHash: string | null;
  /** true mientras el usuario debe cambiar su contraseña (admin le asignó una temporal). */
  debeCambiarPassword: boolean;
  /** Marca temporal: al cambiar/restablecer se cierra la sesión con iat anterior. */
  passwordChangedAt: Date | null;
  /** nombre del rol ('admin' | 'operador'). */
  rol: string;
};

const CON_ROL = {
  id: usuarios.id,
  organizacionId: usuarios.organizacionId,
  correo: usuarios.correo,
  nombre: usuarios.nombre,
  activo: usuarios.activo,
  passwordHash: usuarios.passwordHash,
  debeCambiarPassword: usuarios.debeCambiarPassword,
  passwordChangedAt: usuarios.passwordChangedAt,
  createdAt: usuarios.createdAt,
  updatedAt: usuarios.updatedAt,
  rol: roles.nombre,
};

/** Usuario por id (para el middleware de auth). Inactivo también se devuelve: el caller decide. */
export async function obtenerUsuarioPorId(id: string): Promise<UsuarioSesion | undefined> {
  const [fila] = await db
    .select(CON_ROL)
    .from(usuarios)
    .innerJoin(roles, eq(usuarios.rolId, roles.id))
    .where(eq(usuarios.id, id))
    .limit(1);
  return fila;
}

/** Usuario por correo (para el dev-login). */
export async function obtenerUsuarioPorCorreo(correo: string): Promise<UsuarioSesion | undefined> {
  const [fila] = await db
    .select(CON_ROL)
    .from(usuarios)
    .innerJoin(roles, eq(usuarios.rolId, roles.id))
    .where(eq(usuarios.correo, correo))
    .limit(1);
  return fila;
}

// ---------------------------------------------------------------------------
// CRUD de usuarios — SIEMPRE con contexto de tenant (spec §9: solo admin).
// La tabla `usuarios.correo` es única GLOBALMENTE: un correo usado por otra
// organización produce 23505 → 409 DUPLICADO (decisión de Fase 1, aceptada).
// ---------------------------------------------------------------------------

export async function listarUsuarios(
  ctx: ContextoTenant,
  opciones: { cursor?: Cursor | undefined; limit: number; activo?: boolean | undefined },
): Promise<UsuarioSesion[]> {
  const condiciones: (SQL | undefined)[] = [eq(usuarios.organizacionId, ctx.organizacionId)];
  if (opciones.activo !== undefined) condiciones.push(eq(usuarios.activo, opciones.activo));
  if (opciones.cursor) condiciones.push(cursorMayor(usuarios.nombre, usuarios.id, opciones.cursor));
  return db
    .select(CON_ROL)
    .from(usuarios)
    .innerJoin(roles, eq(usuarios.rolId, roles.id))
    .where(and(...condiciones))
    .orderBy(asc(usuarios.nombre), asc(usuarios.id))
    .limit(opciones.limit);
}

/**
 * Cantidad de admins ACTIVOS de la organización distintos de `excluirId`.
 * Salvaguarda: la organización nunca puede quedar sin ningún admin activo
 * (consulta exacta, sin depender del tamaño de página del listado).
 */
export async function contarOtrosAdminsActivos(
  ctx: ContextoTenant,
  excluirId: string,
): Promise<number> {
  const [fila] = await db
    .select({ total: count() })
    .from(usuarios)
    .innerJoin(roles, eq(usuarios.rolId, roles.id))
    .where(
      and(
        eq(usuarios.organizacionId, ctx.organizacionId),
        eq(usuarios.activo, true),
        eq(roles.nombre, 'admin'),
        ne(usuarios.id, excluirId),
      ),
    );
  return fila?.total ?? 0;
}

export async function obtenerUsuarioEnOrganizacion(
  ctx: ContextoTenant,
  id: string,
): Promise<UsuarioSesion | undefined> {  const [fila] = await db
    .select(CON_ROL)
    .from(usuarios)
    .innerJoin(roles, eq(usuarios.rolId, roles.id))
    .where(and(eq(usuarios.id, id), eq(usuarios.organizacionId, ctx.organizacionId)))
    .limit(1);
  return fila;
}

/** Id del rol por nombre (catálogo global; el enum de la API lo limita a admin/operador). */
export async function obtenerRolPorNombre(nombre: string): Promise<number | undefined> {
  const [fila] = await db.select({ id: roles.id }).from(roles).where(eq(roles.nombre, nombre)).limit(1);
  return fila?.id;
}

export async function crearUsuario(
  ctx: ContextoTenant,
  datos: {
    correo: string;
    nombre: string;
    rolId: number;
    passwordHash?: string | null;
    debeCambiarPassword?: boolean;
    passwordChangedAt?: Date | null;
  },
): Promise<(typeof usuarios.$inferSelect)[]> {
  return db
    .insert(usuarios)
    .values({
      organizacionId: ctx.organizacionId,
      correo: datos.correo,
      nombre: datos.nombre,
      rolId: datos.rolId,
      passwordHash: datos.passwordHash ?? null,
      debeCambiarPassword: datos.debeCambiarPassword ?? false,
      passwordChangedAt: datos.passwordChangedAt ?? null,
    })
    .returning();
}

export async function actualizarUsuario(
  ctx: ContextoTenant,
  id: string,
  parcial: { nombre?: string | undefined; rolId?: number | undefined; activo?: boolean | undefined },
): Promise<(typeof usuarios.$inferSelect)[]> {
  return db
    .update(usuarios)
    .set(parcial)
    .where(and(eq(usuarios.id, id), eq(usuarios.organizacionId, ctx.organizacionId)))
    .returning();
}

/**
 * Actualiza el hash de contraseña y las banderas de política de un usuario
 * (cambio self-service / restablecimiento): password_hash, debe_cambiar_password
 * y password_changed_at.
 */
export async function actualizarPasswordDeUsuario(
  ctx: ContextoTenant,
  id: string,
  parcial: { passwordHash: string; debeCambiarPassword: boolean; passwordChangedAt: Date },
): Promise<(typeof usuarios.$inferSelect)[]> {
  return db
    .update(usuarios)
    .set(parcial)
    .where(and(eq(usuarios.id, id), eq(usuarios.organizacionId, ctx.organizacionId)))
    .returning();
}
