/**
 * Servicio de autenticación (capa services: reglas, no HTTP).
 *
 * Reglas de credenciales (iguales en dev-login y en login con contraseña):
 * un correo que no existe o de un usuario inactivo responde IGUAL
 * (401 CREDENCIALES_INVALIDAS): no se revela existencia de cuentas, consistente
 * con la regla 404-no-403 del spec §5.
 *
 * Gestión de usuarios en producción (task): alta con password temporal,
 * restablecimiento por admin y cambio self-service con invalidación de sesión.
 */
import { firmarTokenSesion, expiracionSegundos } from '../auth/jwt';
import { hashPassword, verificarPassword } from '../auth/password';
import { AppError } from '../errors';
import type { ContextoTenant } from '../middleware/auth';
import {
  actualizarPasswordDeUsuario,
  obtenerUsuarioPorCorreo,
  obtenerUsuarioPorId,
  type UsuarioSesion,
} from '../repositories/usuarios';

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
    debe_cambiar_password: boolean;
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
      debe_cambiar_password: usuario.debeCambiarPassword,
    },
  };
}

/** Inicia sesión dev con un correo de usuario existente y activo. Solo AUTH_MODE=dev. */
export async function iniciarSesionDev(correo: string): Promise<SesionDev> {
  const usuario = await obtenerUsuarioPorCorreo(correo);
  if (!usuario || !usuario.activo) {
    throw new AppError(401, 'CREDENCIALES_INVALIDAS', 'Credenciales inválidas');
  }
  const token = await firmarTokenSesion(usuario.id, {
    dcp: usuario.debeCambiarPassword,
    passwordHash: usuario.passwordHash,
  });
  return construirSesion(token, usuario);
}

/**
 * Inicia sesión con correo + contraseña (AUTH_MODE=password). Requiere el
 * usuario activo Y un hash válido; cualquier fallo responde 401 igual
 * (CREDENCIALES_INVALIDAS), sin distinguir correo inexistente de contraseña
 * incorrecta. Con password temporal (flag en true) también entra: la obligación
 * de cambiarla se resuelve con el cambio self-service.
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
  const token = await firmarTokenSesion(usuario.id, {
    dcp: usuario.debeCambiarPassword,
    passwordHash: usuario.passwordHash,
  });
  return construirSesion(token, usuario);
}

/**
 * Cambio de contraseña autenticado (AUTH_MODE=password): con la contraseña actual
 * verificada, actualiza el hash, limpia el flag debe_cambiar_password, actualiza
 * password_changed_at y emite un JWT nuevo (con dcp=false). La invalidación de la
 * sesión anterior se hace en el caller con el `iat` del token emitido.
 */
export async function cambiarContrasena(
  ctx: ContextoTenant,
  usuarioId: string,
  contrasenaActual: string,
  contrasenaNueva: string,
): Promise<SesionDev> {
  if (contrasenaNueva === contrasenaActual) {
    throw new AppError(400, 'VALIDACION', 'La nueva contraseña debe ser distinta de la actual');
  }
  const usuario = await obtenerUsuarioPorId(usuarioId);
  if (!usuario || !usuario.activo) {
    throw new AppError(401, 'USUARIO_INACTIVO', 'Usuario inactivo o inexistente');
  }
  const validaActual = usuario.passwordHash ? verificarPassword(contrasenaActual, usuario.passwordHash) : false;
  if (!validaActual) {
    throw new AppError(401, 'CREDENCIALES_INVALIDAS', 'Credenciales inválidas');
  }
  const hash = hashPassword(contrasenaNueva);
  const ahora = new Date();
  const [actualizado] = await actualizarPasswordDeUsuario(ctx, usuarioId, {
    passwordHash: hash,
    debeCambiarPassword: false,
    passwordChangedAt: ahora,
  });
  if (!actualizado) throw new AppError(404, 'NO_ENCONTRADO', 'Usuario no encontrado');
  const actualizadoFinal = await obtenerUsuarioPorId(usuarioId);
  if (!actualizadoFinal) throw new AppError(401, 'USUARIO_INACTIVO', 'Usuario inactivo o inexistente');
  // El token nuevo lleva la huella del hash recién guardado; los anteriores
  // (misma persona, hash viejo) quedan inválidos por `ph` y por `iat`.
  const token = await firmarTokenSesion(usuarioId, {
    dcp: false,
    passwordHash: actualizadoFinal.passwordHash,
  });
  return construirSesion(token, actualizadoFinal);
}

/** Resumen del usuario autenticado (respuesta de GET /api/v1/me). */
export type UsuarioActual = {
  id: string;
  correo: string;
  nombre: string;
  rol: string;
  organizacion_id: string;
  debe_cambiar_password: boolean;
};

export function resumenUsuario(usuario: UsuarioSesion): UsuarioActual {
  return {
    id: usuario.id,
    correo: usuario.correo,
    nombre: usuario.nombre,
    rol: usuario.rol,
    organizacion_id: usuario.organizacionId,
    debe_cambiar_password: usuario.debeCambiarPassword,
  };
}
