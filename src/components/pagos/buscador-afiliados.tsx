/**
 * Buscador de nadadores por nombre o documento (Spec del cliente §4.5) con
 * dropdown de resultados. La consulta viaja a la API con debounce (300 ms);
 * solo afiliados ACTIVOS — un retirado no admite nuevos pagos. Los ya
 * elegidos se excluyen de la lista.
 */
import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';

import {
  FILTROS_INICIALES,
  ETIQUETAS_DOCUMENTO,
  parametrosListado,
  type Afiliado,
} from '../../lib/afiliados-datos';
import { useAfiliados, usePlanes } from '../../lib/consultas-afiliados';
import { CampoTexto } from '../ui/campo-texto';

export function BuscadorAfiliados({
  elegidos,
  onAgregar,
}: {
  elegidos: string[];
  onAgregar: (afiliado: Afiliado) => void;
}) {
  const [texto, setTexto] = useState('');
  const [q, setQ] = useState('');

  // Búsqueda con debounce: cada tecla no dispara una consulta.
  useEffect(() => {
    const timer = setTimeout(() => setQ(texto), 300);
    return () => clearTimeout(timer);
  }, [texto]);

  // Escape limpia la búsqueda (y cierra el dropdown).
  useEffect(() => {
    const alEscapar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') {
        setTexto('');
        setQ('');
      }
    };
    document.addEventListener('keydown', alEscapar);
    return () => document.removeEventListener('keydown', alEscapar);
  }, []);

  const consulta = useAfiliados(
    { ...parametrosListado({ ...FILTROS_INICIALES, q, activo: true }), limit: 8 },
    q.trim() !== '',
  );
  const planes = usePlanes();

  const abierta = q.trim() !== '';
  const resultados = (consulta.data?.datos ?? []).filter(
    (afiliado) => !elegidos.includes(afiliado.id),
  );

  const agregar = (afiliado: Afiliado) => {
    onAgregar(afiliado);
    setTexto('');
    setQ('');
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <CampoTexto
          type="search"
          value={texto}
          onChange={(evento) => setTexto(evento.target.value)}
          placeholder="Nombre o documento del nadador…"
          aria-label="Buscar nadadores"
          className="pl-8"
          autoComplete="off"
        />
      </div>

      {abierta && (
        <div
          role="listbox"
          aria-label="Resultados de la búsqueda"
          className="absolute left-0 right-0 z-20 mt-1 max-h-64 overflow-y-auto rounded-md border border-border bg-surface p-1 shadow-lg"
        >
          {consulta.isPending ? (
            <p className="px-2 py-2 text-sm text-muted-foreground">Buscando…</p>
          ) : resultados.length === 0 ? (
            <p className="px-2 py-2 text-sm text-muted-foreground">
              {consulta.isError
                ? 'No se pudo buscar. Intenta de nuevo.'
                : 'Nadie coincide con la búsqueda (o ya está elegido).'}
            </p>
          ) : (
            resultados.map((afiliado) => {
              const nombrePlan = planes.data?.datos.find(
                (plan) => plan.id === afiliado.plan_id,
              )?.nombre;
              return (
                <button
                  key={afiliado.id}
                  type="button"
                  onClick={() => agregar(afiliado)}
                  className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                >
                  <span className="font-medium">{afiliado.nombre}</span>{' '}
                  <span className="text-xs text-muted-foreground tabular-nums">
                    · {ETIQUETAS_DOCUMENTO[afiliado.tipo_documento]} {afiliado.numero_documento}
                    {nombrePlan ? ` · ${nombrePlan}` : ''}
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
