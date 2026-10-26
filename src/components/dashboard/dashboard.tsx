/**
 * Isla del dashboard (Spec del cliente §4.2): cuatro tarjetas, recaudo por
 * mes, dona por estado de pago y los más morosos. Concentra las tres consultas
 * en UNA isla para que compartan un solo QueryClient.
 */
import { ProveedorConsultas } from '../ui/proveedor-consultas';
import { useMorosidad, useRecaudo, useResumen } from '../../lib/consultas-dashboard';
import { GraficoEstados } from './grafico-estados';
import { GraficoRecaudo } from './grafico-recaudo';
import { ListaMorosos } from './lista-morosos';
import { TarjetasResumen } from './tarjetas-resumen';

export function Dashboard() {
  return (
    <ProveedorConsultas>
      <ContenidoDashboard />
    </ProveedorConsultas>
  );
}

function ContenidoDashboard() {
  const resumen = useResumen();
  const morosidad = useMorosidad();
  const recaudo = useRecaudo();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Recaudo, cartera y estado de la organización.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <TarjetasResumen resumen={resumen} morosidad={morosidad} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <GraficoRecaudo consulta={recaudo} />
        </div>
        <GraficoEstados resumen={resumen} />
      </div>

      <ListaMorosos morosidad={morosidad} />
    </div>
  );
}
