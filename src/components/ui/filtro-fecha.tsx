/**
 * Filtro de fecha en el encabezado de una columna (Spec del cliente §4.4:
 * «Registrado» y «Revisado» del Historial). Admite fecha ÚNICA (pone desde =
 * hasta) o RANGO (desde/hasta independientes). Mismo patrón sin Radix que
 * FiltroColumna: botón + panel flotante que se cierra al hacer clic afuera
 * o con Escape. El valor vive en el estado del listado (filtra contra la API).
 */
import { Calendar, ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { cn } from '../../lib/cn';

export function FiltroFecha({
  etiqueta,
  desde,
  hasta,
  onChange,
}: {
  etiqueta: string;
  /** 'AAAA-MM-DD' o ''. */
  desde: string;
  /** 'AAAA-MM-DD' o ''. */
  hasta: string;
  onChange: (campo: 'desde' | 'hasta', valor: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const contenedor = useRef<HTMLDivElement>(null);
  const activo = desde !== '' || hasta !== '';

  useEffect(() => {
    if (!abierto) return;
    const alClicarFuera = (evento: MouseEvent) => {
      if (!contenedor.current?.contains(evento.target as Node)) setAbierto(false);
    };
    const alEscapar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') setAbierto(false);
    };
    document.addEventListener('mousedown', alClicarFuera);
    document.addEventListener('keydown', alEscapar);
    return () => {
      document.removeEventListener('mousedown', alClicarFuera);
      document.removeEventListener('keydown', alEscapar);
    };
  }, [abierto]);

  /** Fecha única: el mismo día en ambos extremos del rango. */
  const fechaUnica = (valor: string) => {
    onChange('desde', valor);
    onChange('hasta', valor);
  };

  const quitar = () => {
    onChange('desde', '');
    onChange('hasta', '');
    setAbierto(false);
  };

  return (
    <div ref={contenedor} className="relative inline-block">
      <button
        type="button"
        onClick={() => setAbierto((estado) => !estado)}
        aria-expanded={abierto}
        aria-haspopup="dialog"
        aria-label={`Filtrar por ${etiqueta}`}
        className={cn(
          'inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide transition-colors hover:text-primary',
          activo ? 'text-primary' : 'text-muted-foreground',
        )}
      >
        {etiqueta}
        <Calendar className={cn('h-3 w-3', activo && 'fill-current')} aria-hidden="true" />
        <ChevronDown className="h-3 w-3" aria-hidden="true" />
      </button>

      {abierto && (
        <div
          role="dialog"
          aria-label={`Filtro de ${etiqueta}`}
          className="absolute left-0 z-20 mt-1 w-64 rounded-md border border-border bg-surface p-3 shadow-lg"
        >
          <label className="block text-xs font-medium text-muted-foreground">
            Fecha única
            <input
              type="date"
              value={desde !== '' && desde === hasta ? desde : ''}
              onChange={(evento) => fechaUnica(evento.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-foreground"
            />
          </label>
          <div className="my-2 border-t border-border" />
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs font-medium text-muted-foreground">
              Desde
              <input
                type="date"
                value={desde}
                onChange={(evento) => onChange('desde', evento.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-foreground"
              />
            </label>
            <label className="block text-xs font-medium text-muted-foreground">
              Hasta
              <input
                type="date"
                value={hasta}
                onChange={(evento) => onChange('hasta', evento.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-foreground"
              />
            </label>
          </div>
          {activo && (
            <button
              type="button"
              onClick={quitar}
              className="mt-2 w-full rounded px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-muted"
            >
              Quitar filtro
            </button>
          )}
        </div>
      )}
    </div>
  );
}
