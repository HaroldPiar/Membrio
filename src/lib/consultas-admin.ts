/**
 * Consultas de administración (Fase 5, Spec del cliente §4.6) con TanStack
 * Query. Las mutaciones viven en cada pestaña (mismo patrón que Fase 3:
 * request dentro del handler + `invalidateQueries`).
 *
 * Solo hay UN hook nuevo: usuarios. Planes y categorías REUTILIZAN
 * `usePlanes`/`useCategorias` de Fase 3 (decisión 40): comparten queryKey,
 * así que editar un plan acá refresca también los selectores de
 * /afiliados y /pagos/nuevo, y al revés.
 */
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { api, procesar } from './api';

import { usuarioSchema } from '../shared/usuarios';
import type { z } from '@hono/zod-openapi';

export type Usuario = z.infer<typeof usuarioSchema>;

/**
 * Usuarios de la organización: primera página de 100 sin cursor (decisión
 * 41) — una organización tiene pocas cuentas; se muestran TODOS (activos e
 * inactivos) para poder reactivar los dados de baja.
 */
export function useUsuarios(): UseQueryResult<{ datos: Usuario[] }, Error> {
  return useQuery<{ datos: Usuario[] }, Error>({
    queryKey: ['admin', 'usuarios'],
    queryFn: async () => {
      const respuesta = await procesar(
        api.GET('/api/v1/usuarios', { params: { query: { limit: 100 } } }),
      );
      return { datos: respuesta.datos };
    },
    staleTime: 30_000,
    retry: false,
  });
}
