/**
 * Consultas del dashboard (Spec del cliente §4.2) con TanStack Query.
 * 30 s de staleTime: el dashboard es una vista de lectura que el operador
 * refresca a mano. Cualquier 401 lo redirige `procesar` (Spec §5).
 */
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { api, procesar } from './api';
import type {
  MorosidadDashboard,
  RecaudoDashboard,
  ResumenDashboard,
} from './dashboard-datos';

export function useResumen(): UseQueryResult<ResumenDashboard, Error> {
  return useQuery<ResumenDashboard, Error>({
    queryKey: ['dashboard', 'resumen'],
    queryFn: () => procesar(api.GET('/api/v1/dashboard/resumen')),
    staleTime: 30_000,
    retry: false,
  });
}

export function useMorosidad(): UseQueryResult<MorosidadDashboard, Error> {
  return useQuery<MorosidadDashboard, Error>({
    queryKey: ['dashboard', 'morosidad'],
    queryFn: () => procesar(api.GET('/api/v1/dashboard/morosidad')),
    staleTime: 30_000,
    retry: false,
  });
}

export function useRecaudo(): UseQueryResult<RecaudoDashboard, Error> {
  return useQuery<RecaudoDashboard, Error>({
    queryKey: ['dashboard', 'recaudo'],
    queryFn: () => procesar(api.GET('/api/v1/dashboard/recaudo')),
    staleTime: 30_000,
    retry: false,
  });
}
