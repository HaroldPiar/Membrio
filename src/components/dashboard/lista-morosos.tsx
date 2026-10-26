/**
 * Lista corta de los más morosos (Spec del cliente §4.2): top 5 ordenado en
 * centavos exactos, meses adeudados como chips y enlace a Afiliados ya filtrado
 * por «En mora» (`/afiliados?estado=en_mora` — el filtro lo consume la Fase 3).
 *
 * El importe se formatea desde el string del wire; los montos jamás se suman
 * ni restan acá.
 */
import { ChevronRight } from 'lucide-react';
import type { UseQueryResult } from '@tanstack/react-query';

import {
  etiquetaMesChip,
  topMorosos,
  type MorosidadDashboard,
} from '../../lib/dashboard-datos';
import { formatearDinero } from '../../lib/formato';
import { ErrorConsulta } from './error-consulta';

const LIMITE = 5;

const formateadorFecha = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'medium',
  timeZone: 'UTC',
});

/** '2026-10-25' → '25 oct 2026' (fecha de cálculo de la cartera). */
function formatearFecha(fecha: string): string {
  return formateadorFecha.format(new Date(`${fecha}T00:00:00Z`));
}

export function ListaMorosos({
  morosidad,
}: {
  morosidad: UseQueryResult<MorosidadDashboard, Error>;
}) {
  if (morosidad.isError) {
    return (
      <ErrorConsulta error={morosidad.error} reintento={() => void morosidad.refetch()} />
    );
  }
  if (morosidad.isPending) {
    return <div className="h-40 animate-pulse rounded-lg border border-border bg-surface" />;
  }

  const { fecha, total_cartera, deudores } = morosidad.data;
  const top = topMorosos(deudores, LIMITE);

  return (
    <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Los más morosos</h2>
          <p className="text-xs text-muted-foreground">
            Cartera total {formatearDinero(total_cartera)} · al {formatearFecha(fecha)}
          </p>
        </div>
        <a
          href="/afiliados?estado=en_mora"
          className="inline-flex items-center gap-0.5 text-xs font-medium text-primary hover:underline"
        >
          Ver en Afiliados
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      </div>

      {top.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Nadie está en mora: la cartera está saldada.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {top.map((deudor) => {
            const excedentes = deudor.meses_adeudados.length - 3;
            return (
              <li
                key={deudor.afiliado_id}
                className="flex items-center justify-between gap-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{deudor.nombre}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {deudor.meses_adeudados.slice(0, 3).map((mes) => (
                      <span
                        key={mes}
                        className="rounded bg-por-vencer-bg px-1.5 py-0.5 text-[11px] font-medium text-por-vencer-fg"
                      >
                        {etiquetaMesChip(mes)}
                      </span>
                    ))}
                    {excedentes > 0 && (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                        +{excedentes}
                      </span>
                    )}
                  </div>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums">
                  {formatearDinero(deudor.valor_adeudado)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
