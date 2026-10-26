/**
 * Pestaña Cartera (Spec del cliente §4.4): quiénes deben qué meses, con
 * acceso directo a «Registrar pago» (fila y botón general → /pagos/nuevo).
 * Usa el MISMO endpoint que el dashboard (/dashboard/morosidad): misma
 * semántica de deuda, mismos montos valorados con descuento del plan.
 * Lista corta sin paginación (mismo criterio que la de morosos del dashboard).
 */
import { ArrowRight, Plus } from 'lucide-react';

import { useMorosidad } from '../../lib/consultas-dashboard';
import { usePlanes } from '../../lib/consultas-afiliados';
import { etiquetaMesChip, topMorosos } from '../../lib/dashboard-datos';
import { formatearDinero, formatearFecha } from '../../lib/formato';
import { ErrorConsulta } from '../ui/error-consulta';
import { EstadoVacio } from '../ui/estado-vacio';
export function TabCartera() {
  const morosidad = useMorosidad();
  const planes = usePlanes();

  if (morosidad.isError) {
    return <ErrorConsulta error={morosidad.error} reintento={() => void morosidad.refetch()} />;
  }
  if (morosidad.isPending) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((n) => (
          <div key={n} className="h-14 animate-pulse rounded-lg border border-border bg-surface" />
        ))}
      </div>
    );
  }

  const { fecha, total_cartera, deudores } = morosidad.data;
  const ordenados = topMorosos(deudores, deudores.length);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            Total en cartera al {formatearFecha(fecha)}:{' '}
            <span className="font-semibold tabular-nums text-foreground">
              {formatearDinero(total_cartera)}
            </span>
          </p>
          <p className="text-sm text-muted-foreground">
            Quienes deben y desde qué meses. Al registrar un pago, la deuda se libera al verificarlo.
          </p>
        </div>
        <a
          href="/pagos/nuevo"
          className="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Registrar pago
        </a>
      </div>

      {ordenados.length === 0 ? (
        <EstadoVacio mensaje="Sin cartera pendiente: nadie adeuda meses facturables." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th scope="col" className="px-3 py-2.5 text-left">
                  Nadador
                </th>
                <th scope="col" className="px-3 py-2.5 text-left">
                  Plan
                </th>
                <th scope="col" className="px-3 py-2.5 text-left">
                  Meses adeudados
                </th>
                <th scope="col" className="px-3 py-2.5 text-right">
                  Adeudado
                </th>
                <th scope="col" className="px-3 py-2.5 text-right">
                  <span className="sr-only">Acción</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {ordenados.map((deudor) => (
                <tr key={deudor.afiliado_id} className="border-b border-border last:border-b-0">
                  <td className="max-w-48 px-3 py-2.5">
                    <p className="truncate font-medium">{deudor.nombre}</p>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {planes.data?.datos.find((plan) => plan.id === deudor.plan_id)?.nombre ?? '—'}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {deudor.meses_adeudados.map((mes) => (
                        <span
                          key={mes}
                          className="rounded bg-por-vencer-bg px-1.5 py-0.5 text-[11px] font-medium text-por-vencer-fg"
                        >
                          {etiquetaMesChip(mes)}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right font-medium tabular-nums">
                    {formatearDinero(deudor.valor_adeudado)}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <a
                      href={`/pagos/nuevo?afiliado=${deudor.afiliado_id}`}
                      className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-surface px-2.5 text-xs font-medium transition-colors hover:bg-muted"
                    >
                      Registrar pago
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
