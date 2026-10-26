/**
 * Filtro desplegable en el encabezado de una columna categórica
 * (Spec del cliente §4.3: Categoría, Plan, Estado; §4.4: estado del pago).
 * Sin Radix: un botón + lista flotante que se cierra al hacer clic afuera o
 * con Escape. El valor vive en el estado del listado (filtra contra la API).
 */
import { ChevronDown, Filter } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { cn } from '../../lib/cn';

export type OpcionFiltro = { valor: string; etiqueta: string };

export function FiltroColumna({
  etiqueta,
  opciones,
  valor,
  onChange,
}: {
  etiqueta: string;
  opciones: OpcionFiltro[];
  valor: string;
  onChange: (valor: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const contenedor = useRef<HTMLDivElement>(null);
  const activo = valor !== '';

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

  const elegir = (opcion: string) => {
    onChange(opcion);
    setAbierto(false);
  };

  return (
    <div ref={contenedor} className="relative inline-block">
      <button
        type="button"
        onClick={() => setAbierto((estado) => !estado)}
        aria-expanded={abierto}
        aria-haspopup="listbox"
        aria-label={`Filtrar por ${etiqueta}`}
        className={cn(
          'inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide transition-colors hover:text-primary',
          activo ? 'text-primary' : 'text-muted-foreground',
        )}
      >
        {etiqueta}
        <Filter className={cn('h-3 w-3', activo && 'fill-current')} aria-hidden="true" />
        <ChevronDown className="h-3 w-3" aria-hidden="true" />
      </button>

      {abierto && (
        <div
          role="listbox"
          aria-label={etiqueta}
          className="absolute left-0 z-20 mt-1 w-48 rounded-md border border-border bg-surface p-1 shadow-lg"
        >
          <button
            type="button"
            onClick={() => elegir('')}
            className={cn(
              'block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted',
              !activo && 'bg-muted font-medium',
            )}
          >
            Todos
          </button>
          {opciones.map((opcion) => (
            <button
              key={opcion.valor}
              type="button"
              onClick={() => elegir(opcion.valor)}
              className={cn(
                'block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted',
                valor === opcion.valor && 'bg-muted font-medium',
              )}
            >
              {opcion.etiqueta}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
