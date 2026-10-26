/**
 * Consultas de afiliados (Fase 3, Spec del cliente §4.3) con TanStack Query.
 * Las mutaciones viven en cada formulario (mismo patrón que el login: request
 * dentro de `handleSubmit` + `queryClient.invalidateQueries(['afiliados'])`).
 *
 * Los catálogos (planes, categorías, EPS) son casi estáticos: 10 minutos de
 * staleTime. Cualquier 401 lo redirige `procesar` (Spec §5).
 */
import { keepPreviousData, useQuery, type UseQueryResult } from '@tanstack/react-query';

import { api, procesar } from './api';
import type { Acudiente, Afiliado, parametrosListado } from './afiliados-datos';
import type { z } from '@hono/zod-openapi';

import { categoriaSchema, epsSchema, planSchema } from '../shared/catalogos';
import { pagoResumenSchema } from '../shared/pagos';

export type AfiliadosPaginados = {
  datos: Afiliado[];
  paginacion: { limit: number; cursor_siguiente: string | null };
};
export type Plan = z.infer<typeof planSchema>;
export type Categoria = z.infer<typeof categoriaSchema>;
export type Eps = z.infer<typeof epsSchema>;
export type PagoResumen = z.infer<typeof pagoResumenSchema>;

type ParametrosListado = ReturnType<typeof parametrosListado>;

/**
 * Listado con filtros y cursor. `keepPreviousData` evita el parpadeo al pasar
 * de página: se ve la página anterior hasta que llega la nueva.
 */
export function useAfiliados(parametros: ParametrosListado): UseQueryResult<AfiliadosPaginados, Error> {
  return useQuery<AfiliadosPaginados, Error>({
    queryKey: ['afiliados', 'lista', parametros],
    // OJO: openapi-fetch solo serializa `params.query` (el top-level `query`
    // pasa por el type catch-all pero el runtime lo ignora).
    queryFn: () => procesar(api.GET('/api/v1/afiliados', { params: { query: parametros } })),
    staleTime: 15_000,
    retry: false,
    placeholderData: keepPreviousData,
  });
}

export function useAcudientes(afiliadoId: string | null): UseQueryResult<Acudiente[], Error> {
  return useQuery<Acudiente[], Error>({
    queryKey: ['afiliados', 'acudientes', afiliadoId],
    queryFn: () =>
      procesar(
        api.GET('/api/v1/afiliados/{id}/acudientes', { params: { path: { id: afiliadoId ?? '' } } }),
      ),
    enabled: afiliadoId !== null,
    staleTime: 30_000,
    retry: false,
  });
}

export function usePlanes(): UseQueryResult<{ datos: Plan[] }, Error> {
  return useQuery<{ datos: Plan[] }, Error>({
    queryKey: ['afiliados', 'planes'],
    queryFn: async () => {
      const respuesta = await procesar(
        api.GET('/api/v1/planes', { params: { query: { limit: 100 } } }),
      );
      return { datos: respuesta.datos };
    },
    staleTime: 600_000,
    retry: false,
  });
}

export function useCategorias(): UseQueryResult<{ datos: Categoria[] }, Error> {
  return useQuery<{ datos: Categoria[] }, Error>({
    queryKey: ['afiliados', 'categorias'],
    queryFn: async () => {
      const respuesta = await procesar(
        api.GET('/api/v1/categorias', { params: { query: { limit: 100 } } }),
      );
      return { datos: respuesta.datos };
    },
    staleTime: 600_000,
    retry: false,
  });
}

export function useEps(): UseQueryResult<Eps[], Error> {
  return useQuery<Eps[], Error>({
    queryKey: ['afiliados', 'eps'],
    queryFn: () => procesar(api.GET('/api/v1/eps')),
    staleTime: 600_000,
    retry: false,
  });
}

/** Historial de pagos del afiliado (panel de detalle): últimos 10. */
export function useHistorialPagos(afiliadoId: string | null): UseQueryResult<{ datos: PagoResumen[] }, Error> {
  return useQuery<{ datos: PagoResumen[] }, Error>({
    queryKey: ['afiliados', 'historial', afiliadoId],
    queryFn: () =>
      procesar(
        api.GET('/api/v1/pagos', {
          params: { query: { afiliado: afiliadoId ?? '', limit: 10 } },
        }),
      ),
    enabled: afiliadoId !== null,
    staleTime: 30_000,
    retry: false,
  });
}
