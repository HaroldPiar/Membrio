/**
 * Tabla de afiliados con TanStack Table (Spec del cliente §5) y filtros en el
 * encabezado de las columnas categóricas (§4.3: Categoría, Plan, Estado de
 * pago y Activo). El orden y la paginación los hace la API (nombre ASC con
 * cursor opaco): la tabla solo renderiza — sin orden client-side.
 */
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table';
import { useMemo } from 'react';

import {
  ETIQUETAS_ESTADO_PAGO,
  type Afiliado,
  type FiltrosAfiliados,
} from '../../lib/afiliados-datos';
import { cn } from '../../lib/cn';
import type { Categoria, Plan } from '../../lib/consultas-afiliados';
import { EstadoPago } from '../ui/estado-pago';
import { FiltroColumna, type OpcionFiltro } from '../ui/filtro-columna';

export function TablaAfiliados({
  filas,
  filtros,
  onFiltro,
  onSeleccionar,
  planes,
  categorias,
}: {
  filas: Afiliado[];
  filtros: FiltrosAfiliados;
  onFiltro: (campo: 'activo' | 'categoria' | 'plan' | 'estado_pago', valor: string) => void;
  onSeleccionar: (id: string) => void;
  planes: Plan[];
  categorias: Categoria[];
}) {
  const nombresPlanes = useMemo(() => new Map(planes.map((plan) => [plan.id, plan.nombre])), [planes]);
  const nombresCategorias = useMemo(
    () => new Map(categorias.map((categoria) => [categoria.id, categoria.nombre])),
    [categorias],
  );

  const opcionesCategoria: OpcionFiltro[] = categorias.map((categoria) => ({
    valor: categoria.id,
    etiqueta: categoria.nombre,
  }));
  const opcionesPlan: OpcionFiltro[] = planes.map((plan) => ({ valor: plan.id, etiqueta: plan.nombre }));
  const opcionesEstado: OpcionFiltro[] = (
    Object.entries(ETIQUETAS_ESTADO_PAGO) as [keyof typeof ETIQUETAS_ESTADO_PAGO, string][]
  ).map(([valor, etiqueta]) => ({ valor, etiqueta }));
  const opcionesActivo: OpcionFiltro[] = [
    { valor: 'true', etiqueta: 'Activos' },
    { valor: 'false', etiqueta: 'Retirados' },
  ];

  const columnas: ColumnDef<Afiliado>[] = [
    {
      accessorKey: 'nombre',
      header: 'Afiliado',
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{row.original.nombre}</p>
          <p className="truncate text-xs text-muted-foreground">{row.original.correo}</p>
        </div>
      ),
    },
    {
      accessorKey: 'numero_documento',
      header: 'Documento',
      cell: ({ row }) => (
        <span className="whitespace-nowrap tabular-nums">
          <span className="mr-1.5 rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
            {row.original.tipo_documento}
          </span>
          {row.original.numero_documento}
        </span>
      ),
    },
    {
      accessorKey: 'categoria_id',
      header: () => (
        <FiltroColumna
          etiqueta="Categoría"
          opciones={opcionesCategoria}
          valor={filtros.categoria}
          onChange={(valor) => onFiltro('categoria', valor)}
        />
      ),
      cell: ({ row }) => nombresCategorias.get(row.original.categoria_id) ?? '—',
    },
    {
      accessorKey: 'plan_id',
      header: () => (
        <FiltroColumna
          etiqueta="Plan"
          opciones={opcionesPlan}
          valor={filtros.plan}
          onChange={(valor) => onFiltro('plan', valor)}
        />
      ),
      cell: ({ row }) => nombresPlanes.get(row.original.plan_id) ?? '—',
    },
    {
      accessorKey: 'estado_pago',
      header: () => (
        <FiltroColumna
          etiqueta="Estado de pago"
          opciones={opcionesEstado}
          valor={filtros.estado_pago ?? ''}
          onChange={(valor) => onFiltro('estado_pago', valor)}
        />
      ),
      cell: ({ row }) =>
        row.original.activo ? (
          <EstadoPago estado={row.original.estado_pago} />
        ) : (
          <span className="inline-flex rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            Retirado
          </span>
        ),
    },
    {
      accessorKey: 'activo',
      header: () => (
        <FiltroColumna
          etiqueta="Activo"
          opciones={opcionesActivo}
          valor={filtros.activo === null ? '' : String(filtros.activo)}
          onChange={(valor) => onFiltro('activo', valor)}
        />
      ),
      cell: ({ row }) => (
        <span
          className={cn(
            'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium',
            row.original.activo ? 'bg-al-dia-bg text-al-dia-fg' : 'bg-muted text-muted-foreground',
          )}
        >
          {row.original.activo ? 'Sí' : 'No'}
        </span>
      ),
    },
  ];

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
              className="cursor-pointer border-b border-border transition-colors last:border-b-0 hover:bg-muted/60"
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
