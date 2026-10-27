/**
 * Isla de /afiliados (Spec del cliente §4.3): búsqueda, filtros en encabezado,
 * paginación por cursor, panel de detalle y el formulario de alta/edición.
 * Una sola isla para que las consultas compartan el mismo QueryClient.
 *
 * Los filtros se reflejan en la URL (replaceState, conservando el estado del
 * ClientRouter) para que el enlace del dashboard —/afiliados?estado=en_mora—
 * sea el punto de partida y lo que el usuario arma sea compartible.
 */
import { Search, UserPlus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import {
  FILTROS_INICIALES,
  alternarOrden,
  conFiltro,
  filtrosAUrl,
  parametrosListado,
  type Afiliado,
  type EstadoPagoAfiliado,
  type FiltrosAfiliados,
} from '../../lib/afiliados-datos';
import { useAfiliados, useCategorias, useEps, usePlanes } from '../../lib/consultas-afiliados';
import { useSesion } from '../../lib/sesion';
import { EstadoVacio } from '../ui/estado-vacio';
import { ErrorConsulta } from '../ui/error-consulta';
import { Boton } from '../ui/boton';
import { CampoTexto } from '../ui/campo-texto';
import { ProveedorConsultas } from '../ui/proveedor-consultas';
import { FormularioAfiliado } from './form-afiliado';
import { PanelDetalle } from './panel-detalle';
import { TablaAfiliados } from './tabla-afiliados';

function EsqueletoListado() {
  return (
    <div className="space-y-2">
      {[0, 1, 2, 3, 4].map((n) => (
        <div key={n} className="h-14 animate-pulse rounded-lg border border-border bg-surface" />
      ))}
    </div>
  );
}

export function Afiliados({
  estadoInicial,
  qInicial,
  ordenInicial,
  direccionInicial,
}: {
  estadoInicial: EstadoPagoAfiliado | null;
  qInicial: string;
  ordenInicial?: 'nombre' | 'documento' | undefined;
  direccionInicial?: 'asc' | 'desc' | undefined;
}) {
  return (
    <ProveedorConsultas>
      <ContenidoAfiliados
        estadoInicial={estadoInicial}
        qInicial={qInicial}
        ordenInicial={ordenInicial}
        direccionInicial={direccionInicial}
      />
    </ProveedorConsultas>
  );
}

function ContenidoAfiliados({
  estadoInicial,
  qInicial,
  ordenInicial,
  direccionInicial,
}: {
  estadoInicial: EstadoPagoAfiliado | null;
  qInicial: string;
  ordenInicial?: 'nombre' | 'documento' | undefined;
  direccionInicial?: 'asc' | 'desc' | undefined;
}) {
  const [filtros, setFiltros] = useState<FiltrosAfiliados>({
    ...FILTROS_INICIALES,
    estado_pago: estadoInicial,
    q: qInicial,
    orden: ordenInicial ?? 'nombre',
    direccion: direccionInicial ?? 'asc',
  });
  const [texto, setTexto] = useState(qInicial);
  const [pila, setPila] = useState<string[]>([]);
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const [vista, setVista] = useState<{ tipo: 'lista' } | { tipo: 'formulario'; afiliado: Afiliado | null }>({
    tipo: 'lista',
  });

  /** Cambiar filtros SIEMPRE vuelve a la primera página. */
  const cambiarFiltros = (actualizar: (previo: FiltrosAfiliados) => FiltrosAfiliados) => {
    setFiltros(actualizar);
    setPila((anterior) => (anterior.length > 0 ? [] : anterior));
  };

  // Búsqueda con debounce: cada tecla no dispara una consulta.
  useEffect(() => {
    const timer = setTimeout(
      () => cambiarFiltros((previo) => (previo.q === texto ? previo : { ...previo, q: texto })),
      300,
    );
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al cambiar el texto
  }, [texto]);

  // Filtros en la URL, conservando el state del ClientRouter de Astro.
  useEffect(() => {
    history.replaceState(history.state, '', filtrosAUrl(filtros));
  }, [filtros]);

  const cursor = pila.at(-1);
  const parametros = useMemo(() => parametrosListado(filtros, cursor), [filtros, cursor]);
  const lista = useAfiliados(parametros);
  const planes = usePlanes();
  const categorias = useCategorias();
  const eps = useEps();
  const sesion = useSesion();

  const seleccionado = lista.data?.datos.find((afiliado) => afiliado.id === seleccion) ?? null;

  // El filtro activo puede sacar al afiliado de la página: se cierra solo.
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

  const catalogosListos = !planes.isPending && !categorias.isPending && !eps.isPending;
  const esAdmin = sesion.data?.rol === 'admin';
  const hayFiltros =
    filtros.q.trim() !== '' ||
    filtros.activo !== null ||
    filtros.categoria !== '' ||
    filtros.plan !== '' ||
    filtros.estado_pago !== null;

  if (vista.tipo === 'formulario') {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          {vista.afiliado ? 'Editar afiliado' : 'Nuevo afiliado'}
        </h1>
        {catalogosListos ? (
          <FormularioAfiliado
            afiliado={vista.afiliado}
            planes={planes.data?.datos ?? []}
            categorias={categorias.data?.datos ?? []}
            eps={eps.data ?? []}
            onCancelar={() => setVista({ tipo: 'lista' })}
            onListo={(guardado) => {
              setVista({ tipo: 'lista' });
              setSeleccion(guardado.id);
            }}
          />
        ) : (
          <EsqueletoListado />
        )}
      </div>
    );
  }

  const siguiente = lista.data?.paginacion.cursor_siguiente ?? null;
  const retroceder = () => setPila((anterior) => anterior.slice(0, -1));
  const avanzar = () => {
    if (siguiente) setPila((anterior) => [...anterior, siguiente]);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Afiliados</h1>
          <p className="text-sm text-muted-foreground">
            Nadadores del club: busca, filtra y abre una fila para ver el detalle.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <CampoTexto
              type="search"
              value={texto}
              onChange={(evento) => setTexto(evento.target.value)}
              placeholder="Nombre o documento…"
              aria-label="Buscar afiliados"
              className="w-56 pl-8"
            />
          </div>
          <Boton disabled={!catalogosListos} onClick={() => setVista({ tipo: 'formulario', afiliado: null })}>
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            Nuevo afiliado
          </Boton>
        </div>
      </div>

      {lista.isError ? (
        <ErrorConsulta error={lista.error} reintento={() => void lista.refetch()} />
      ) : lista.isPending ? (
        <EsqueletoListado />
      ) : lista.data.datos.length === 0 ? (
        <EstadoVacio
          mensaje={
            hayFiltros
              ? 'Nadie coincide con los filtros actuales. Quita alguno para ver más afiliados.'
              : 'Aún no hay afiliados registrados. Crea el primero con «Nuevo afiliado».'
          }
        />
      ) : (
        <TablaAfiliados
          filas={lista.data.datos}
          filtros={filtros}
          onFiltro={(campo, valor) => cambiarFiltros((previo) => conFiltro(previo, campo, valor))}
          onOrden={(campo) => cambiarFiltros((previo) => alternarOrden(previo, campo))}
          onSeleccionar={setSeleccion}
          planes={planes.data?.datos ?? []}
          categorias={categorias.data?.datos ?? []}
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

      {seleccionado && (
        <PanelDetalle
          afiliado={seleccionado}
          planes={planes.data?.datos ?? []}
          categorias={categorias.data?.datos ?? []}
          eps={eps.data ?? []}
          esAdmin={esAdmin}
          onCerrar={() => setSeleccion(null)}
          onEditar={() => setVista({ tipo: 'formulario', afiliado: seleccionado })}
          onRetirado={() => setSeleccion(null)}
        />
      )}
    </div>
  );
}
