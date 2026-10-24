/**
 * Servicio de autenticación (capa services: reglas, no HTTP).
 *
 * Regla del dev-login: un correo que no existe o de un usuario inactivo
 * responde IGUAL (401 CREDENCIALES_INVALIDAS): no se revela existencia de
 * cuentas, consistente con la regla 404-no-403 del spec §5.
 */
import { firmarTokenDev, expiracionSegundos } from '../auth/jwt';
import { AppError } from '../errors';
import { obtenerUsuarioPorCorreo, type UsuarioSesion } from '../repositories/usuarios';

export type SesionDev = {
  token: string;
  token_type: 'Bearer';
  /** Unix seconds (exp del JWT). */
  expira_en: number | undefined;
  usuario: {
    id: string;
    correo: string;
    nombre: string;
    rol: string;
    organizacion_id: string;
  };
};

/** Inicia sesión dev con un correo de usuario existente y activo. Solo AUTH_MODE=dev. */
export async function iniciarSesionDev(correo: string): Promise<SesionDev> {
  const usuario = await obtenerUsuarioPorCorreo(correo);
  if (!usuario || !usuario.activo) {
    throw new AppError(401, 'CREDENCIALES_INVALIDAS', 'Credenciales inválidas');
  }
  const token = await firmarTokenDev(usuario.id);
  return {
    token,
    token_type: 'Bearer',
    expira_en: expiracionSegundos(token),
    usuario: {
      id: usuario.id,
      correo: usuario.correo,
      nombre: usuario.nombre,
      rol: usuario.rol,
      organizacion_id: usuario.organizacionId,
    },
  };
}

/** Resumen del usuario autenticado (respuesta de GET /api/v1/me). */
export type UsuarioActual = Omit<SesionDev['usuario'], 'organizacion_id'> & {
  organizacion_id: string;
};

export function resumenUsuario(usuario: UsuarioSesion): UsuarioActual {
  return {
    id: usuario.id,
    correo: usuario.correo,
    nombre: usuario.nombre,
    rol: usuario.rol,
    organizacion_id: usuario.organizacionId,
  };
}
