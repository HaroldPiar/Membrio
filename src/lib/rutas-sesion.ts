/**
 * Destino del cliente después de iniciar sesión (puro y testeable).
 *
 * Con `debe_cambiar_password` activo el usuario va DIRECTO a /cambiar-password
 * (sin pasar por el dashboard): la API le responde 403 CAMBIO_PASSWORD_REQUERIDO
 * a todo lo demás. Sin el flag, al dashboard.
 */
export function destinoTrasLogin(usuario: { debe_cambiar_password?: boolean } | undefined): string {
  return usuario?.debe_cambiar_password ? '/cambiar-password' : '/';
}
