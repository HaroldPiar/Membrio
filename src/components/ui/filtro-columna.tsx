/**
 * Filtro desplegable en el encabezado de una columna categórica
 * (Spec del cliente §4.3: Categoría, Plan, Estado; §4.4: estado del pago).
 * Sin Radix: un botón + lista flotante que se cierra al hacer clic afuera o
 * con Escape. El valor vive en el estado del listado (filtra contra la API).
 *
 * La lista se posiciona con `position: fixed` calculado contra el viewport
 * (QASpec Unidad 3): dentro de la tabla (contenedor con `overflow-x-auto`)
 * quedaba recortada, y con pocas filas había que hacer scroll DENTRO de la
 * tabla para alcanzar las últimas opciones. Si no cabe abajo, se abre hacia
 * arriba; si la tabla scrollea, la lista se reubica.
 */
import { ChevronDown, Filter } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { cn } from '../../lib/cn';

export type OpcionFiltro = { valor: string; etiqueta: string };

/** Ancho de la lista (w-48 = 192px) + holgura, para no salirse por la derecha. */
const ANCHO_LISTA = 192;
const MARGEN = 8;
/** Altura aproximada de cada opción: evita un salto al medir en el primer frame. */
const ALTO_OPCION = 30;

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
  const [posicion, setPosicion] = useState<{ left: number; top: number } | null>(null);
  const contenedor = useRef<HTMLDivElement>(null);
  const activo = valor !== '';

  /** Punto del viewport donde va la lista: abajo si cabe, arriba si no. */
  const ubicar = () => {
    const caja = contenedor.current?.getBoundingClientRect();
    if (!caja) return;
    const alto = (opciones.length + 1) * ALTO_OPCION + MARGEN * 2;
    const cabeAbajo = caja.bottom + alto <= window.innerHeight;
    const top = cabeAbajo ? caja.bottom + 4 : Math.max(MARGEN, caja.top - alto - 4);
    const left = Math.min(caja.left, window.innerWidth - ANCHO_LISTA - MARGEN);
    setPosicion({ left, top });
  };

  useEffect(() => {
    if (!abierto) return;
    const alClicarFuera = (evento: MouseEvent) => {
      if (!contenedor.current?.contains(evento.target as Node)) setAbierto(false);
    };
    const alEscapar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') setAbierto(false);
    };
    // capture: la tabla scrollea en su propio contenedor, no en window.
    const alReposicionar = () => ubicar();
    document.addEventListener('mousedown', alClicarFuera);
    document.addEventListener('keydown', alEscapar);
    document.addEventListener('scroll', alReposicionar, true);
    window.addEventListener('resize', alReposicionar);
    return () => {
      document.removeEventListener('mousedown', alClicarFuera);
      document.removeEventListener('keydown', alEscapar);
      document.removeEventListener('scroll', alReposicionar, true);
      window.removeEventListener('resize', alReposicionar);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reposiciona al abrir
  }, [abierto]);

  const alternar = () => {
    // Se posiciona ANTES de renderizar: sin el frame en -9999px.
    if (!abierto) ubicar();
    setAbierto((estado) => !estado);
  };

  const elegir = (opcion: string) => {
    onChange(opcion);
    setAbierto(false);
  };

  return (
    <div ref={contenedor} className="relative inline-block">
      <button
        type="button"
        onClick={alternar}
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
          style={{ left: posicion?.left ?? -9999, top: posicion?.top ?? -9999 }}
          className="fixed z-30 w-48 rounded-md border border-border bg-surface p-1 shadow-lg"
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
