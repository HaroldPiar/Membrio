/**
 * Tabla de pagos con TanStack Table (§5) para las pestañas Por verificar e
 * Historial (§4.4). La API ordena por fecha de registro y pagina con cursor
 * opaco: la tabla solo renderiza — sin orden ni paginación client-side.
 * El Historial filtra EN los encabezados de columna (§4.4): Estado
 * desplegable, Registrado y Revisado por fecha única o rango, Factura por
 * texto parcial; la bandeja de verificación muestra lo esencial.
 */
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table';
import { useMemo, type ReactNode } from 'react';

import { cn } from '../../lib/cn';
import type { PagoResumen } from '../../lib/consultas-pagos';
import { formatearDinero, formatearInstante } from '../../lib/formato';
import {
  OPCIONES_ESTADO_VERIFICACION,
  type CamposFiltroPagos,
  type FiltrosPagos,
} from '../../lib/pagos-datos';
import { EstadoVerificacion } from '../ui/estado-verificacion';
import { FiltroColumna } from '../ui/filtro-columna';
import { FiltroFecha } from '../ui/filtro-fecha';
import { FiltroTexto } from '../ui/filtro-texto';

export function TablaPagos({
  filas,
  historial,
  filtros,
  onFiltro,
  onSeleccionar,
}: {
  filas: PagoResumen[];
  /** true = Historial (estado + fechas + factura); false = bandeja de verificación. */
  historial: boolean;
  filtros: FiltrosPagos;
  onFiltro: (campo: CamposFiltroPagos, valor: string) => void;
  onSeleccionar: (id: string) => void;
}) {
  const columnas: ColumnDef<PagoResumen>[] = useMemo(() => {
    // En la bandeja los encabezados son texto plano: los filtros de columna
    // solo existen en el Historial (el estado de la bandeja es fijo).
    const encabezado = (etiqueta: string, filtro: ReactNode) =>
      historial ? filtro : etiqueta;

    const base: ColumnDef<PagoResumen>[] = [
      {
        accessorKey: 'created_at',
        header: () =>
          encabezado(
            'Registrado',
            <FiltroFecha
              etiqueta="Registrado"
              desde={filtros.desde}
              hasta={filtros.hasta}
              onChange={(campo, valor) => onFiltro(campo, valor)}
            />,
          ),
        cell: ({ row }) => (
          <span className="whitespace-nowrap tabular-nums">
            {formatearInstante(row.original.created_at)}
          </span>
        ),
      },
      {
        accessorKey: 'factura_nombre',
        header: () =>
          encabezado(
            'Factura',
            <FiltroTexto
              etiqueta="Factura"
              valor={filtros.factura}
              placeholder="Nombre o documento…"
              onChange={(valor) => onFiltro('factura', valor)}
            />,
          ),
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium">{row.original.factura_nombre}</p>
            <p className="truncate text-xs text-muted-foreground tabular-nums">
              {row.original.factura_tipo_documento} {row.original.factura_documento}
            </p>
          </div>
        ),
      },
      {
        accessorKey: 'monto_total',
        header: 'Monto',
        cell: ({ row }) => (
          <span className="whitespace-nowrap font-medium tabular-nums">
            {formatearDinero(row.original.monto_total)}
          </span>
        ),
      },
    ];

    if (!historial) return base;

    base.push(
      {
        accessorKey: 'estado',
        header: () => (
          <FiltroColumna
            etiqueta="Estado"
            opciones={OPCIONES_ESTADO_VERIFICACION}
            valor={filtros.estado ?? ''}
            onChange={(valor) => onFiltro('estado', valor)}
          />
        ),
        cell: ({ row }) => <EstadoVerificacion estado={row.original.estado} />,
      },
      {
        accessorKey: 'revisado_en',
        header: () => (
          <FiltroFecha
            etiqueta="Revisado"
            desde={filtros.revisado_desde}
            hasta={filtros.revisado_hasta}
            onChange={(campo, valor) =>
              onFiltro(campo === 'desde' ? 'revisado_desde' : 'revisado_hasta', valor)
            }
          />
        ),
        cell: ({ row }) =>
          row.original.revisado_en ? (
            <span className="whitespace-nowrap tabular-nums">
              {formatearInstante(row.original.revisado_en)}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
    );
    return base;
  }, [historial, filtros, onFiltro]);

  const tabla = useReactTable({
    columns: columnas,
    data: filas,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface shadow-sm">
      <table className="w-full text-sm">
        <thead>
          {tabla.getHeaderGroups().map((grupo) => (
            <tr key={grupo.id} className="border-b border-border bg-muted/50">
              {grupo.headers.map((encabezado) => (
                <th key={encabezado.id} scope="col" className="px-3 py-2.5 text-left">
                  {encabezado.isPlaceholder
                    ? null
                    : flexRender(encabezado.column.columnDef.header, encabezado.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {tabla.getRowModel().rows.map((fila) => (
            <tr
              key={fila.id}
              onClick={() => onSeleccionar(fila.original.id)}
              className={cn(
                'cursor-pointer border-b border-border transition-colors last:border-b-0 hover:bg-muted/60',
              )}
            >
              {fila.getVisibleCells().map((celda) => (
                <td key={celda.id} className="px-3 py-2.5 align-middle">
                  {flexRender(celda.column.columnDef.cell, celda.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
