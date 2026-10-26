/**
 * Dona por estado de pago (Spec del cliente §4.2): Al día · Por vencer · En
 * mora. Los sectores usan los tokens de estado (§2.2) vía `style` (CSS real,
 * las variables resuelven) y la leyenda lleva color + texto + cantidad, nunca
 * solo color (accesibilidad, §2.2).
 */
import type { UseQueryResult } from '@tanstack/react-query';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';

import {
  porcentajes,
  porcionesEstados,
  type EstadoAfiliado,
  type ResumenDashboard,
} from '../../lib/dashboard-datos';
import { ErrorConsulta } from '../ui/error-consulta';

const COLORES: Record<EstadoAfiliado, string> = {
  al_dia: 'var(--al-dia-fg)',
  por_vencer: 'var(--por-vencer-fg)',
  en_mora: 'var(--en-mora-fg)',
};

const ETIQUETAS: Record<EstadoAfiliado, string> = {
  al_dia: 'Al día',
  por_vencer: 'Por vencer',
  en_mora: 'En mora',
};

export function GraficoEstados({
  resumen,
}: {
  resumen: UseQueryResult<ResumenDashboard, Error>;
}) {
  if (resumen.isError) {
    return <ErrorConsulta error={resumen.error} reintento={() => void resumen.refetch()} />;
  }
  if (resumen.isPending) {
    return <div className="h-72 animate-pulse rounded-lg border border-border bg-surface" />;
  }

  const porciones = porcionesEstados(resumen.data.afiliados);
  const conPorcentaje = porcentajes(porciones);
  const activos = resumen.data.afiliados.activos;

  return (
    <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
      <div className="mb-3">
        <h2 className="text-sm font-semibold">Estado de pago</h2>
        <p className="text-xs text-muted-foreground">Afiliados activos</p>
      </div>

      {porciones.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No hay afiliados activos.
        </p>
      ) : (
        <>
          <div className="relative">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={porciones}
                  dataKey="cantidad"
                  nameKey="estado"
                  innerRadius={52}
                  outerRadius={82}
                  paddingAngle={2}
                  stroke="none"
                  isAnimationActive={false}
                >
                  {porciones.map((porcion) => (
                    <Cell
                      key={porcion.estado}
                      style={{ fill: COLORES[porcion.estado] }}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-semibold tabular-nums">{activos}</span>
              <span className="text-[11px] text-muted-foreground">activos</span>
            </div>
          </div>

          <ul className="mt-3 space-y-1.5">
            {conPorcentaje.map(({ estado, cantidad, porcentaje }) => (
              <li key={estado} className="flex items-center gap-2 text-sm">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: COLORES[estado] }}
                  aria-hidden="true"
                />
                <span className="flex-1">{ETIQUETAS[estado]}</span>
                <span className="tabular-nums text-muted-foreground">
                  {cantidad} · {porcentaje}%
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
