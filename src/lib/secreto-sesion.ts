/**
 * Selección del secreto del JWT de sesión para el middleware de Astro.
 *
 * Función pura (sin `astro:middleware` ni `process.env` internos) para poder
 * testearla aislada: el middleware le pasa el modo y los secretos del entorno.
 * Es UX de navegación, no seguridad: la API revalida el token en cada petición.
 */
export function seleccionarSecretoSesion(config: {
  authMode?: string | undefined;
  devJwtSecret?: string | undefined;
  sessionJwtSecret?: string | undefined;
  supabaseJwtSecret?: string | undefined;
}): string | undefined {
  switch (config.authMode) {
    case 'password':
      return config.sessionJwtSecret;
    case 'supabase':
      return config.supabaseJwtSecret;
    default:
      return config.devJwtSecret;
  }
}
