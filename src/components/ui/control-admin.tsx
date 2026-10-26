/**
 * Guarda de /admin (Spec del cliente §3.1): el menú y esta pantalla se ocultan
 * por rol, pero la SEGURIDAD es de la API (403). Mientras /me resuelve se
 * muestra un estado neutro; con rol distinto de admin, "sin permiso".
 */
import type { ReactNode } from 'react';

import { ShieldX } from 'lucide-react';

import { useSesion } from '../../lib/sesion';
import { ProveedorConsultas } from './proveedor-consultas';

function PantallaSinPermiso() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <ShieldX className="h-10 w-10 text-error-fg" aria-hidden="true" />
      <h1 className="text-xl font-semibold">No tienes permiso</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Esta sección es solo para administradores. Si necesitas acceso, pídeselo a un administrador
        de tu organización.
      </p>
      <a href="/" className="text-sm font-medium text-primary hover:underline">
        Volver al dashboard
      </a>
    </main>
  );
}

function Cargando() {
  return (
    <main className="flex min-h-[60vh] items-center justify-center">
      <p className="text-sm text-muted-foreground">Cargando…</p>
    </main>
  );
}

export function ControlAdmin({ children }: { children: ReactNode }) {
  return (
    <ProveedorConsultas>
      <ContenidoAdmin>{children}</ContenidoAdmin>
    </ProveedorConsultas>
  );
}

function ContenidoAdmin({ children }: { children: ReactNode }) {
  const { data: usuario, isLoading } = useSesion();
  if (isLoading) return <Cargando />;
  if (!usuario || usuario.rol !== 'admin') return <PantallaSinPermiso />;
  return <>{children}</>;
}
