/**
 * Filtro de texto en el encabezado de una columna (Spec del cliente §4.4:
 * «Factura» del Historial: búsqueda parcial en el nombre/documento de la
 * factura). Mismo patrón sin Radix que FiltroColumna: botón + panel
 * flotante con input; aplica con Enter o «Aplicar».
 */
import { ChevronDown, Filter } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';

import { cn } from '../../lib/cn';

export function FiltroTexto({
  etiqueta,
  valor,
  onChange,
  placeholder,
}: {
  etiqueta: string;
  /** Texto actual del filtro ('' = sin filtro). */
  valor: string;
  onChange: (valor: string) => void;
  placeholder?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [borrador, setBorrador] = useState(valor);
  const contenedor = useRef<HTMLDivElement>(null);
  const activo = valor.trim() !== '';

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

  const aplicar = (evento: FormEvent) => {
    evento.preventDefault();
    onChange(borrador.trim());
    setAbierto(false);
  };

  const quitar = () => {
    setBorrador('');
    onChange('');
    setAbierto(false);
  };

  return (
    <div ref={contenedor} className="relative inline-block">
      <button
        type="button"
        onClick={() => {
          setBorrador(valor);
          setAbierto((estado) => !estado);
        }}
        aria-expanded={abierto}
        aria-haspopup="dialog"
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
        <form
          role="dialog"
          aria-label={`Filtro de ${etiqueta}`}
          onSubmit={aplicar}
          className="absolute left-0 z-20 mt-1 w-64 rounded-md border border-border bg-surface p-3 shadow-lg"
        >
          <label className="block text-xs font-medium text-muted-foreground">
            Contenido
            <input
              type="search"
              autoFocus
              value={borrador}
              onChange={(evento) => setBorrador(evento.target.value)}
              placeholder={placeholder ?? 'Texto a buscar…'}
              className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-foreground"
            />
          </label>
          <div className="mt-2 flex justify-between gap-2">
            {activo ? (
              <button
                type="button"
                onClick={quitar}
                className="rounded px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted"
              >
                Quitar
              </button>
            ) : (
              <span />
            )}
            <button
              type="submit"
              className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted"
            >
              Aplicar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
