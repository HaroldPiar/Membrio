/**
 * Repositorio de usuarios: el ÚNICO lugar que toca la tabla usuarios con Drizzle
 * (regla de capas: routes → services → repositories).
 *
 * Estos lookups son de IDENTIDAD (van antes de existir contexto de tenant):
 * el middleware de auth busca el usuario por el sub del JWT o por el correo
 * del dev-login; de esa fila sale el organizacion_id que SÍ entra al contexto.
 */
import { eq } from 'drizzle-orm';

import { db } from '../db/client';
import { roles, usuarios } from '../db/schema';

export type UsuarioSesion = {
  id: string;
  organizacionId: string;
  correo: string;
  nombre: string;
  activo: boolean;
  /** nombre del rol ('admin' | 'operador'). */
  rol: string;
};

const CON_ROL = {
  id: usuarios.id,
  organizacionId: usuarios.organizacionId,
  correo: usuarios.correo,
  nombre: usuarios.nombre,
  activo: usuarios.activo,
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
