/**
 * Sesión del cliente: consulta GET /me con TanStack Query y cierre de sesión.
 *
 * La protección de rutas SIN parpadeo es del servidor (src/middleware.ts
 * verifica la cookie antes de renderizar); aquí solo se sostiene el dato de
 * usuario para el menú lateral y el control de /admin. Si /me responde 401,
 * `procesar` redirige a /login (Spec del cliente §5).
 */
import { useQuery } from '@tanstack/react-query';

import { api, procesar } from './api';
import type { paths } from './tipos-api';

export type UsuarioActual =
  paths['/api/v1/me']['get']['responses'][200]['content']['application/json'];

export async function obtenerUsuarioActual(): Promise<UsuarioActual> {
  return procesar(api.GET('/api/v1/me'));
}

/** Usuario autenticado: cached Infinity (solo cambia al entrar o salir). */
export function useSesion() {
  return useQuery({
    queryKey: ['sesion'],
    queryFn: obtenerUsuarioActual,
    staleTime: Infinity,
    retry: false,
  });
}

/** Cierra la sesión (borra la cookie) y vuelve al login. */
export async function cerrarSesion(): Promise<void> {
  try {
    await procesar(api.POST('/api/v1/auth/logout'));
  } catch {
    // 401 ya redirige a /login; con cualquiera otro igual queremos salir.
  }
  window.location.assign('/login');
}
