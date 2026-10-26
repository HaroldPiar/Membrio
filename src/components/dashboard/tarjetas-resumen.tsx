/**
 * Cuatro tarjetas del dashboard (Spec del cliente §4.2): recaudo del mes,
 * cartera pendiente, afiliados activos y pagos por verificar.
 *
 * Los montos se formatean desde los strings del wire con `formatearDinero`;
 * los conteos son números de conteo (no dinero).
 */
import type { UseQueryResult } from '@tanstack/react-query';
import { Banknote, ClipboardCheck, TriangleAlert, Users, type LucideIcon } from 'lucide-react';

import { formatearDinero } from '../../lib/formato';
import type { MorosidadDashboard, ResumenDashboard } from '../../lib/dashboard-datos';
import { cn } from '../../lib/cn';
import { ErrorConsulta } from '../ui/error-consulta';

type DatosTarjeta = {
  etiqueta: string;
  valor: string;
  nota: string;
  Icono: LucideIcon;
  acento: string;
};

function EsqueletoTarjetas() {
  return (
    <>
      {[0, 1, 2, 3].map((n) => (
        <div key={n} className="h-28 animate-pulse rounded-lg border border-border bg-surface" />
      ))}
    </>
  );
}

export function TarjetasResumen({
  resumen,
  morosidad,
}: {
  resumen: UseQueryResult<ResumenDashboard, Error>;
  morosidad: UseQueryResult<MorosidadDashboard, Error>;
}) {
  if (resumen.isError) {
    return (
      <ErrorConsulta error={resumen.error} reintento={() => void resumen.refetch()} />
    );
  }
  if (morosidad.isError) {
    return (
      <ErrorConsulta error={morosidad.error} reintento={() => void morosidad.refetch()} />
    );
  }
  if (resumen.isPending || morosidad.isPending) return <EsqueletoTarjetas />;

  const r = resumen.data;
  const m = morosidad.data;
  const deudores = m.deudores.length;

  const tarjetas: DatosTarjeta[] = [
    {
      etiqueta: 'Recaudo del mes',
      valor: formatearDinero(r.recaudo_mes_actual),
      nota: 'Pagos verificados de este mes',
      Icono: Banknote,
      acento: 'text-primary',
    },
    {
      etiqueta: 'Cartera pendiente',
      valor: formatearDinero(m.total_cartera),
      nota:
        deudores === 0
          ? 'Sin deudas pendientes'
          : `${deudores} ${deudores === 1 ? 'nadador debe' : 'nadadores deben'} mensualidades`,
      Icono: TriangleAlert,
      acento: deudores > 0 ? 'text-en-mora-fg' : 'text-muted-foreground',
    },
    {
      etiqueta: 'Afiliados activos',
      valor: String(r.afiliados.activos),
      nota: `De ${r.afiliados.total} afiliados en total (${r.afiliados.retirados} retirados)`,
      Icono: Users,
      acento: 'text-al-dia-fg',
    },
    {
      etiqueta: 'Pagos por verificar',
      valor: String(r.pagos.pendientes),
      nota:
        r.pagos.pendientes > 0
          ? 'Esperando verificación en Pagos'
          : 'Bandeja de verificación vacía',
      Icono: ClipboardCheck,
      acento: r.pagos.pendientes > 0 ? 'text-por-vencer-fg' : 'text-muted-foreground',
    },
  ];

  return (
    <>
      {tarjetas.map(({ etiqueta, valor, nota, Icono, acento }) => (
        <div
          key={etiqueta}
          className="rounded-lg border border-border bg-surface p-4 shadow-sm"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm text-muted-foreground">{etiqueta}</p>
            <Icono className={cn('h-4 w-4 shrink-0', acento)} aria-hidden="true" />
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{valor}</p>
          <p className="mt-1 text-xs text-muted-foreground">{nota}</p>
        </div>
      ))}
    </>
  );
}
