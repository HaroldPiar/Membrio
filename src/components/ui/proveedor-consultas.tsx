/**
 * Proveedor de TanStack Query para las islas. Cada isla que consulta datos
 * monta el suyo (aislamiento simple mientras no exista una isla raíz).
 * `retry: false`: los errores de la API (401/403/404…) no se reintentan.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

export function ProveedorConsultas({ children }: { children: ReactNode }) {
  const [cliente] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));
  return <QueryClientProvider client={cliente}>{children}</QueryClientProvider>;
}
