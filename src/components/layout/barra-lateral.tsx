/**
 * Menú lateral (Spec del cliente §3): colapsable 240 px ↔ 64 px con el estado
 * recordado en localStorage, cajón superpuesto en móvil, ítem activo con fondo
 * primario suave y barra lateral, y pie con nombre+rol, tema y cerrar sesión.
 * El encabezado solo lleva "Membrio": el disparador del cajón vive aquí.
 *
 * Los datos del usuario salen de GET /me (TanStack Query). Hasta que llega el
 * rol no se pintan las entradas Administración (y las de operador salen del
 * listado si el usuario resulta operador): sin parpadeos de ítems falsos.
 */
import {
  ChevronsLeft,
  ChevronsRight,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Waves,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { cn } from '../../lib/cn';
import { cerrarSesion, useSesion } from '../../lib/sesion';
import { Boton } from '../ui/boton';
import { ProveedorConsultas } from '../ui/proveedor-consultas';
import { entradasParaRol, esEntradaActiva, type IconoMenu } from './entradas-menu';
import { SelectorTema } from './selector-tema';

const ICONOS: Record<IconoMenu, LucideIcon> = {
  panel: LayoutDashboard,
  olas: Waves,
  tarjeta: CreditCard,
  ajustes: Settings,
};

const CLAVE_COLAPSADO = 'membrio_menu_colapsado';

export function BarraLateral(props: { rutaActual: string }) {
  return (
    <ProveedorConsultas>
      <ContenidoBarra {...props} />
    </ProveedorConsultas>
  );
}

function ContenidoBarra({ rutaActual }: { rutaActual: string }) {
  const { data: usuario } = useSesion();
  const [colapsado, setColapsado] = useState(false);
  const [abiertoMovil, setAbiertoMovil] = useState(false);

  // El estado recordado se lee en cliente: evita diferir SSR y parpadeo.
  useEffect(() => {
    setColapsado(window.localStorage.getItem(CLAVE_COLAPSADO) === '1');
  }, []);

  const alternarColapso = (): void => {
    setColapsado((anterior) => {
      const nuevo = !anterior;
      window.localStorage.setItem(CLAVE_COLAPSADO, nuevo ? '1' : '0');
      return nuevo;
    });
  };

  const entradas = entradasParaRol(usuario?.rol);
  const iniciales =inicialesDe(usuario?.nombre);

  return (
    <>
      <button
        type="button"
        aria-label="Abrir menú"
        onClick={() => setAbiertoMovil(true)}
        className="fixed left-3 top-1.5 z-40 flex h-9 w-9 items-center justify-center rounded-md text-foreground/80 transition-colors hover:bg-muted md:hidden"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>

      {abiertoMovil && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setAbiertoMovil(false)}
          aria-hidden="true"
        />
      )}

      <aside
        aria-label="Menú lateral"
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r bg-surface transition-transform md:sticky md:inset-y-auto md:top-12 md:h-[calc(100dvh-3rem)] md:translate-x-0',
          abiertoMovil ? 'translate-x-0' : '-translate-x-full',
          colapsado && 'md:w-16',
        )}
      >
        <div className={cn('flex items-center border-b px-3 py-2', colapsado ? 'justify-center' : 'justify-between')}>
          {!colapsado && (
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Menú</span>
          )}
          <button
            type="button"
            onClick={alternarColapso}
            aria-label={colapsado ? 'Expandir menú' : 'Contraer menú'}
            title={colapsado ? 'Expandir menú' : 'Contraer menú'}
            className="hidden h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:flex"
          >
            {colapsado ? (
              <ChevronsRight className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronsLeft className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-2" aria-label="Navegación principal">
          {!usuario && (
            <ul className="space-y-1" aria-hidden="true">
              {[0, 1, 2].map((n) => (
                <li key={n} className="h-9 animate-pulse rounded-md bg-muted" />
              ))}
            </ul>
          )}
          {usuario && (
            <ul className="space-y-1">
              {entradas.map((entrada) => {
                const Icono = ICONOS[entrada.icono];
                const activa = esEntradaActiva(entrada, rutaActual);
                return (
                  <li key={entrada.ruta}>
                    <a
                      href={entrada.ruta}
                      aria-current={activa ? 'page' : undefined}
                      title={colapsado ? entrada.etiqueta : undefined}
                      onClick={() => setAbiertoMovil(false)}
                      className={cn(
                        'relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                        colapsado && 'justify-center px-0',
                        activa
                          ? 'bg-primary/10 text-primary'
                          : 'text-foreground/70 hover:bg-muted hover:text-foreground',
                      )}
                    >
                      {activa && (
                        <span className="absolute inset-y-1.5 left-0 w-1 rounded-full bg-primary" aria-hidden="true" />
                      )}
                      <Icono className="h-5 w-5 shrink-0" aria-hidden="true" />
                      {!colapsado && <span>{entrada.etiqueta}</span>}
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </nav>

        <div className="space-y-3 border-t p-3">
          <div className={cn('flex items-center gap-2', colapsado && 'justify-center')}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
              {iniciales}
            </div>
            {!colapsado && (
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{usuario?.nombre ?? 'Cargando…'}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {usuario ? (usuario.rol === 'admin' ? 'Administrador' : 'Operador') : ''}
                </p>
              </div>
            )}
          </div>

          <SelectorTema compacto={colapsado} />

          <Boton
            variante="fantasma"
            className={cn('w-full', colapsado ? 'justify-center px-0' : 'justify-start')}
            title="Cerrar sesión"
            onClick={() => void cerrarSesion()}
          >
            <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
            {!colapsado && <span>Cerrar sesión</span>}
          </Boton>
        </div>
      </aside>
    </>
  );
}

function inicialesDe(nombre: string | undefined): string {
  if (!nombre) return '…';
  const partes = nombre.trim().split(/\s+/).slice(0, 2);
  return partes.map((p) => p.charAt(0).toUpperCase()).join('') || '…';
}
