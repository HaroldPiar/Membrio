/**
 * Consultas de pagos (Fase 4, Spec del cliente §4.4–4.5) con TanStack Query.
 * Las mutaciones (verificar/rechazar, alta) viven en cada componente, con el
 * mismo patrón que la Fase 3: request en el handler + invalidateQueries.
 *
 * El comprobante NO viaja por el API: la ruta guardada se cambia por una URL
 * firmada de lectura (POST /archivos/lectura, §10) justo antes de mostrarla.
 * Cualquier 401 lo redirige `procesar` (Spec §5).
 */
import { keepPreviousData, useQueries, useQuery, type UseQueryResult } from '@tanstack/react-query';

import { api, procesar } from './api';
import type { ParametrosPagos } from './pagos-datos';
import type { z } from '@hono/zod-openapi';

import { urlFirmadaSchema } from '../shared/archivos';
import { afiliadoSchema } from '../shared/afiliados';
import { pagoResumenSchema, pagoSchema } from '../shared/pagos';

export type Pago = z.infer<typeof pagoSchema>;
export type PagoResumen = z.infer<typeof pagoResumenSchema>;
export type UrlFirmada = z.infer<typeof urlFirmadaSchema>;
export type Afiliado = z.infer<typeof afiliadoSchema>;

export type PagosPaginados = {
  datos: PagoResumen[];
  paginacion: { limit: number; cursor_siguiente: string | null };
};

/**
 * Listado con filtros y cursor (Por verificar / Historial). `keepPreviousData`
 * evita el parpadeo al pasar de página: se ve la anterior hasta que llega la nueva.
 */
export function usePagos(
  parametros: ParametrosPagos,
  habilitado = true,
): UseQueryResult<PagosPaginados, Error> {
  return useQuery<PagosPaginados, Error>({
    queryKey: ['pagos', 'lista', parametros],
    // OJO: openapi-fetch solo serializa `params.query` (el top-level `query`
    // pasa por el type catch-all pero el runtime lo ignora).
    queryFn: () => procesar(api.GET('/api/v1/pagos', { params: { query: parametros } })),
    enabled: habilitado,
    staleTime: 15_000,
    retry: false,
    placeholderData: keepPreviousData,
  });
}

/** Detalle con líneas (el panel abre uno por fila). */
export function usePago(id: string | null): UseQueryResult<Pago, Error> {
  return useQuery<Pago, Error>({
    queryKey: ['pagos', 'detalle', id],
    queryFn: () =>
      procesar(api.GET('/api/v1/pagos/{id}', { params: { path: { id: id ?? '' } } })),
    enabled: id !== null,
    staleTime: 30_000,
    retry: false,
  });
}

/** Ruta guardada → URL firmada de lectura (5 min de vida, §10). */
export function useComprobante(ruta: string | null): UseQueryResult<UrlFirmada, Error> {
  return useQuery<UrlFirmada, Error>({
    queryKey: ['pagos', 'comprobante', ruta],
    queryFn: () =>
      procesar(api.POST('/api/v1/archivos/lectura', { body: { ruta: ruta ?? '' } })),
    enabled: ruta !== null,
    staleTime: 60_000,
    retry: false,
  });
}

export type DetalleAfiliados = {
  /** Nombres por id para las líneas de un pago (una consulta por nadador). */
  datos: Record<string, Afiliado>;
  isPending: boolean;
  isError: boolean;
  refetch: () => void;
};

export function useAfiliadosDetalle(ids: readonly string[]): DetalleAfiliados {
  const consultas = useQueries({
    queries: ids.map((id) => ({
      queryKey: ['afiliados', 'detalle', id],
      queryFn: () =>
        procesar(api.GET('/api/v1/afiliados/{id}', { params: { path: { id } } })),
      staleTime: 300_000,
      retry: false,
    })),
  });

  const datos: Record<string, Afiliado> = {};
  consultas.forEach((consulta, posicion) => {
    const id = ids[posicion];
    if (id && consulta.data) datos[id] = consulta.data;
  });

  return {
    datos,
    isPending: consultas.some((consulta) => consulta.isPending),
    isError: consultas.some((consulta) => consulta.isError),
    refetch: () => {
      for (const consulta of consultas) void consulta.refetch();
    },
  };
}
