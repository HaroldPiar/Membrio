/**
 * Isla de /pagos (Spec del cliente §4.4): tres pestañas — Por verificar
 * (bandeja diaria), Historial (filtros en los encabezados de columna: estado,
 * fecha única/rango de registro, factura por texto y fecha de revisión) y
 * Cartera — con paginación por cursor y panel de detalle. Una sola isla para
 * que las consultas compartan el mismo QueryClient.
 *
 * A diferencia de /afiliados, los filtros NO se reflejan en la URL: el
 * contrato de fase no lo pide y la pestaña activa tampoco — decisión 31.
 */
import { Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { cn } from '../../lib/cn';
import { usePagos } from '../../lib/consultas-pagos';
import { useResumen } from '../../lib/consultas-dashboard';
import {
  FILTROS_INICIALES_PAGOS,
  FILTROS_PENDIENTES,
  conFiltroPagos,
  hayFiltrosPagos,
  parametrosPagos,
  type FiltrosPagos,
} from '../../lib/pagos-datos';
import { Boton } from '../ui/boton';
import { EstadoVacio } from '../ui/estado-vacio';
import { ErrorConsulta } from '../ui/error-consulta';
import { ProveedorConsultas } from '../ui/proveedor-consultas';
import { PanelPago } from './panel-pago';
import { TabCartera } from './tab-cartera';
import { TablaPagos } from './tabla-pagos';

type Pestana = 'verificar' | 'historial' | 'cartera';

const PESTANAS: { valor: Pestana; etiqueta: string }[] = [
  { valor: 'verificar', etiqueta: 'Por verificar' },
  { valor: 'historial', etiqueta: 'Historial' },
  { valor: 'cartera', etiqueta: 'Cartera' },
];

function EsqueletoListado() {
  return (
    <div className="space-y-2">
      {[0, 1, 2, 3, 4].map((n) => (
        <div key={n} className="h-14 animate-pulse rounded-lg border border-border bg-surface" />
      ))}
    </div>
  );
}

export function Pagos() {
  return (
    <ProveedorConsultas>
      <ContenidoPagos />
    </ProveedorConsultas>
  );
}

function ContenidoPagos() {
  const [pestana, setPestana] = useState<Pestana>('verificar');
  const [filtros, setFiltros] = useState<FiltrosPagos>(FILTROS_INICIALES_PAGOS);
  const [pila, setPila] = useState<string[]>([]);
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const resumen = useResumen();

  /** Cambiar de pestaña o de filtros SIEMPRE vuelve a la primera página. */
  const reiniciar = () => setPila((anterior) => (anterior.length > 0 ? [] : anterior));
  const cambiarPestana = (nueva: Pestana) => {
    setPestana(nueva);
    setSeleccion(null);
    reiniciar();
  };
  const cambiarFiltros = (actualizar: (previo: FiltrosPagos) => FiltrosPagos) => {
    setFiltros(actualizar);
    reiniciar();
  };

  const esBandeja = pestana === 'verificar';
  const filtrosEfectivos = esBandeja ? FILTROS_PENDIENTES : filtros;
  const cursor = pila.at(-1);
  const parametros = useMemo(
    () => parametrosPagos(filtrosEfectivos, cursor),
    [filtrosEfectivos, cursor],
  );
  const lista = usePagos(parametros, pestana !== 'cartera');

  const seleccionado = lista.data?.datos.find((pago) => pago.id === seleccion) ?? null;

  // El cambio de pestaña/filtros puede sacar al pago de la página: se cierra solo.
  useEffect(() => {
    if (seleccion && lista.data && !seleccionado) setSeleccion(null);
  }, [seleccion, lista.data, seleccionado]);

  // Sin scroll de fondo mientras el panel está abierto.
  useEffect(() => {
    if (!seleccionado) return;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = anterior;
    };
  }, [seleccionado]);

  const pendientes = resumen.data?.pagos.pendientes ?? 0;
  const hayFiltros = hayFiltrosPagos(filtros);

  const siguiente = lista.data?.paginacion.cursor_siguiente ?? null;
  const retroceder = () => setPila((anterior) => anterior.slice(0, -1));
  const avanzar = () => {
    if (siguiente) setPila((anterior) => [...anterior, siguiente]);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pagos</h1>
        <p className="text-sm text-muted-foreground">
          Verifica comprobantes, consulta el historial y mira quién debe qué meses.
        </p>
      </div>

      <div role="tablist" aria-label="Secciones de pagos" className="flex gap-1 border-b border-border">
        {PESTANAS.map((item) => {
          const activa = pestana === item.valor;
          return (
            <button
              key={item.valor}
              type="button"
              role="tab"
              aria-selected={activa}
              onClick={() => cambiarPestana(item.valor)}
              className={cn(
                '-mb-px flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors',
                activa
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {item.etiqueta}
              {item.valor === 'verificar' && pendientes > 0 && (
                <span className="rounded-full bg-por-vencer-bg px-2 py-0.5 text-[11px] font-semibold text-por-vencer-fg">
                  {pendientes}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {pestana === 'cartera' ? (
        <TabCartera />
      ) : (
        <>
          {esBandeja ? (
            <p className="text-sm text-muted-foreground">
              Pagos esperando verificación. Abre uno para ver el comprobante y decidir.
            </p>
          ) : (
            hayFiltros && (
              <div className="flex flex-wrap items-end gap-3">
                <p className="text-sm text-muted-foreground">
                  Filtros activos en los encabezados de las columnas.
                </p>
                <Boton
                  variante="fantasma"
                  tamano="chico"
                  onClick={() => cambiarFiltros(() => FILTROS_INICIALES_PAGOS)}
                >
                  <Search className="h-3.5 w-3.5" aria-hidden="true" />
                  Limpiar filtros
                </Boton>
              </div>
            )
          )}

          {lista.isError ? (
            <ErrorConsulta error={lista.error} reintento={() => void lista.refetch()} />
          ) : lista.isPending ? (
            <EsqueletoListado />
          ) : lista.data.datos.length === 0 ? (
            <EstadoVacio
              mensaje={
                esBandeja
                  ? 'No hay pagos esperando verificación: la bandeja está al día.'
                  : hayFiltros
                    ? 'Ningún pago coincide con los filtros actuales.'
                    : 'Aún no hay pagos registrados.'
              }
            />
          ) : (
            <TablaPagos
              filas={lista.data.datos}
              historial={!esBandeja}
              filtros={filtros}
              onFiltro={(campo, valor) => cambiarFiltros((previo) => conFiltroPagos(previo, campo, valor))}
              onSeleccionar={setSeleccion}
            />
          )}

          {(pila.length > 0 || siguiente) && (
            <div className="flex items-center justify-between">
              <Boton variante="borde" onClick={retroceder} disabled={pila.length === 0 || lista.isFetching}>
                Anterior
              </Boton>
              <span className="text-sm text-muted-foreground">Página {pila.length + 1}</span>
              <Boton variante="borde" onClick={avanzar} disabled={!siguiente || lista.isFetching}>
                Siguiente
              </Boton>
            </div>
          )}

          {seleccionado && <PanelPago pago={seleccionado} onCerrar={() => setSeleccion(null)} />}
        </>
      )}
    </div>
  );
}
