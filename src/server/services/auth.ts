/**
 * Servicio de autenticación (capa services: reglas, no HTTP).
 *
 * Reglas de credenciales (iguales en dev-login y en login con contraseña):
 * un correo que no existe o de un usuario inactivo responde IGUAL
 * (401 CREDENCIALES_INVALIDAS): no se revela existencia de cuentas, consistente
 * con la regla 404-no-403 del spec §5.
 */
import { firmarTokenSesion, expiracionSegundos } from '../auth/jwt';
import { verificarPassword } from '../auth/password';
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

/** Construye la sesión (token + expira + usuario resumido) desde un token ya firmado. */
function construirSesion(token: string, usuario: UsuarioSesion): SesionDev {
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

/** Inicia sesión dev con un correo de usuario existente y activo. Solo AUTH_MODE=dev. */
export async function iniciarSesionDev(correo: string): Promise<SesionDev> {
  const usuario = await obtenerUsuarioPorCorreo(correo);
  if (!usuario || !usuario.activo) {
    throw new AppError(401, 'CREDENCIALES_INVALIDAS', 'Credenciales inválidas');
  }
  const token = await firmarTokenSesion(usuario.id);
  return construirSesion(token, usuario);
}

/**
 * Inicia sesión con correo + contraseña (AUTH_MODE=password). Requiere el
 * usuario activo Y un hash válido; cualquier fallo responde 401 igual
 * (CREDENCIALES_INVALIDAS), sin distinguir correo inexistente de contraseña
 * incorrecta.
 */
export async function iniciarSesionPassword(
  correo: string,
  contrasena: string,
): Promise<SesionDev> {
  const usuario = await obtenerUsuarioPorCorreo(correo);
  if (!usuario || !usuario.activo || !usuario.passwordHash) {
    throw new AppError(401, 'CREDENCIALES_INVALIDAS', 'Credenciales inválidas');
  }
  if (!verificarPassword(contrasena, usuario.passwordHash)) {
    throw new AppError(401, 'CREDENCIALES_INVALIDAS', 'Credenciales inválidas');
  }
  const token = await firmarTokenSesion(usuario.id);
  return construirSesion(token, usuario);
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
