/**
 * Gráfico de barras de recaudo por mes (Spec del cliente §4.2).
 *
 * La geometría usa `magnitud` (derivada del string solo para escalar); el
 * monto del tooltip se formatea desde el STRING original con `formatearDinero`
 * (Spec §5: el cliente no calcula montos). Los colores van por CSS
 * (styles/graficos.css) para seguir el modo oscuro sin re-render.
 */
import type { UseQueryResult } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import {
  etiquetaMesLarga,
  serieRecaudo,
  type PuntoRecaudo,
  type RecaudoDashboard,
} from '../../lib/dashboard-datos';
import { formatearDinero } from '../../lib/formato';
import { ErrorConsulta } from './error-consulta';

const formatoEje = new Intl.NumberFormat('es-CO', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

function ContenidoTooltip(props: {
  active?: boolean | undefined;
  payload?: readonly { payload?: PuntoRecaudo | undefined }[] | undefined;
}) {
  const punto = props.payload?.[0]?.payload;
  if (!props.active || !punto) return null;
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2 text-xs shadow-md">
      <p className="font-medium">{etiquetaMesLarga(punto.mes)}</p>
      <p className="mt-0.5 tabular-nums text-muted-foreground">
        {formatearDinero(punto.total)}
      </p>
    </div>
  );
}

export function GraficoRecaudo({
  consulta,
}: {
  consulta: UseQueryResult<RecaudoDashboard, Error>;
}) {
  if (consulta.isError) {
    return <ErrorConsulta error={consulta.error} reintento={() => void consulta.refetch()} />;
  }
  if (consulta.isPending) {
    return <div className="h-72 animate-pulse rounded-lg border border-border bg-surface" />;
  }

  const serie = serieRecaudo(consulta.data.meses);

  return (
    <div className="grafico-recaudo rounded-lg border border-border bg-surface p-4 shadow-sm">
      <div className="mb-3">
        <h2 className="text-sm font-semibold">Recaudo por mes</h2>
        <p className="text-xs text-muted-foreground">Últimos 12 meses verificados</p>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={serie} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="etiqueta"
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={12}
          />
          <YAxis
            width={54}
            tickLine={false}
            axisLine={false}
            tickFormatter={(valor: number) => formatoEje.format(valor)}
          />
          <Tooltip
            cursor={{ stroke: 'var(--borde)' }}
            content={(props) => (
              <ContenidoTooltip
                active={props.active}
                payload={
                  props.payload as unknown as
                    | readonly { payload?: PuntoRecaudo | undefined }[]
                    | undefined
                }
              />
            )}
          />
          <Bar dataKey="magnitud" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={56} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
