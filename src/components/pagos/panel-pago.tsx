/**
 * Panel lateral de detalle de un pago (Spec del cliente §4.4): comprobante
 * junto a los datos, líneas con el nombre del nadador y las acciones
 * Verificar / Rechazar.
 *
 * Rechazar libera los meses — el copy lo dice EXPLÍCITAMENTE (§4.4) porque
 * la API borra las líneas de detalle (§8.1.5). Transiciones: pendiente →
 * verificado|rechazado y verificado → rechazado; rechazado es terminal
 * (services/pagos.ts). La seguridad es de la API (requerirRol admin u operador).
 */
import { useQueryClient } from '@tanstack/react-query';
import { FileText, ShieldCheck, X } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { etiquetaMesLarga } from '../../lib/dashboard-datos';
import { api, procesar } from '../../lib/api';
import {
  useAfiliadosDetalle,
  useComprobante,
  usePago,
  type PagoResumen,
} from '../../lib/consultas-pagos';
import { formatearDinero, formatearInstante } from '../../lib/formato';
import {
  ETIQUETAS_CONCEPTO,
  ETIQUETAS_DOCUMENTO_FACTURACION,
  esImagen,
} from '../../lib/pagos-datos';
import { Boton } from '../ui/boton';
import { ErrorConsulta } from '../ui/error-consulta';
import { EstadoVerificacion } from '../ui/estado-verificacion';

function Dato({ etiqueta, valor, className }: { etiqueta: string; valor: string; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-xs text-muted-foreground">{etiqueta}</dt>
      <dd className="text-sm font-medium">{valor || '—'}</dd>
    </div>
  );
}

function TituloSeccion({ children }: { children: ReactNode }) {
  return (
    <h3 className="border-b border-border pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </h3>
  );
}

export function PanelPago({
  pago,
  onCerrar,
}: {
  /** Fila del listado (lo espera ya cargada el detalle). */
  pago: PagoResumen;
  onCerrar: () => void;
}) {
  const queryClient = useQueryClient();
  const detalle = usePago(pago.id);
  const [confirmandoRechazo, setConfirmandoRechazo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  // Escape cierra el panel; el bloqueo de scroll vive en el listado.
  useEffect(() => {
    const alEscapar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') onCerrar();
    };
    document.addEventListener('keydown', alEscapar);
    return () => document.removeEventListener('keydown', alEscapar);
  }, [onCerrar]);

  const lineas = detalle.data?.lineas ?? [];
  const idsAfiliados = useMemo(
    () => [...new Set(lineas.map((linea) => linea.afiliado_id))],
    [lineas],
  );
  const afiliados = useAfiliadosDetalle(idsAfiliados);
  const comprobante = useComprobante(detalle.data?.url_comprobante ?? null);

  const cambiarEstado = async (estado: 'verificado' | 'rechazado') => {
    setAviso(null);
    setGuardando(true);
    try {
      await procesar(
        api.PATCH('/api/v1/pagos/{id}/estado', {
          params: { path: { id: pago.id } },
          body: { estado },
        }),
      );
      // Estado del afiliado y métricas del dashboard dependen de las líneas.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['pagos'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['afiliados'] }),
      ]);
      // Tras un cambio exitoso la bandeja avanza: se cierra el panel.
      onCerrar();
    } catch (error) {
      setAviso(error instanceof Error ? error.message : 'No se pudo actualizar el estado.');
      setGuardando(false);
      setConfirmandoRechazo(false);
    }
  };

  const estado = detalle.data?.estado ?? pago.estado;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onCerrar} aria-hidden="true" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Pago ${formatearDinero(pago.monto_total)}`}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col bg-surface shadow-xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-border p-4">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Pago</p>
            <h2 className="text-lg font-semibold tabular-nums">
              {formatearDinero(pago.monto_total)}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Registrado el {formatearInstante(pago.created_at)}
            </p>
            <div className="mt-2">
              <EstadoVerificacion estado={estado} />
            </div>
          </div>
          <Boton variante="fantasma" tamano="icono" onClick={onCerrar} aria-label="Cerrar panel">
            <X className="h-4 w-4" aria-hidden="true" />
          </Boton>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto p-4">
          {aviso && (
            <p role="alert" className="rounded-md bg-en-mora-bg px-3 py-2 text-sm text-en-mora-fg">
              {aviso}
            </p>
          )}

          {estado === 'verificado' && (
            <p className="rounded-md bg-al-dia-bg px-3 py-2 text-sm text-al-dia-fg">
              {detalle.data?.revisado_en
                ? `Verificado el ${formatearInstante(detalle.data.revisado_en)}.`
                : 'Verificado.'}{' '}
              Aún puedes rechazarlo si el comprobante no cuadra.
            </p>
          )}
          {estado === 'rechazado' && (
            <p className="rounded-md bg-en-mora-bg px-3 py-2 text-sm text-en-mora-fg">
              {detalle.data?.revisado_en
                ? `Rechazado el ${formatearInstante(detalle.data.revisado_en)}. `
                : 'Rechazado. '}
              Sus líneas se borraron: los meses quedaron libres y hay que registrar un pago nuevo
              para cobrarlos.
            </p>
          )}

          {confirmandoRechazo ? (
            <div className="space-y-3 rounded-lg border border-en-mora-fg/40 bg-en-mora-bg p-4">
              <p className="text-sm font-semibold text-en-mora-fg">Rechazar este pago</p>
              <p className="text-xs text-en-mora-fg">
                Rechazar <strong>libera los meses</strong>: se borran sus líneas de detalle, los
                afiliados vuelven a adeudar esos meses y el pago no se puede re-verificar (habría
                que registrar uno nuevo). ¿Continuar?
              </p>
              <div className="flex justify-end gap-2">
                <Boton
                  variante="fantasma"
                  tamano="chico"
                  onClick={() => setConfirmandoRechazo(false)}
                  disabled={guardando}
                >
                  Cancelar
                </Boton>
                <Boton
                  tamano="chico"
                  onClick={() => void cambiarEstado('rechazado')}
                  disabled={guardando}
                  className="bg-en-mora-fg text-white hover:bg-en-mora-fg/90"
                >
                  {guardando ? 'Rechazando…' : 'Sí, rechazar y liberar'}
                </Boton>
              </div>
            </div>
          ) : (
            estado !== 'rechazado' && (
              <div className="flex gap-2">
                {estado === 'pendiente' && (
                  <Boton
                    tamano="chico"
                    onClick={() => void cambiarEstado('verificado')}
                    disabled={guardando}
                  >
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    {guardando ? 'Verificando…' : 'Verificar'}
                  </Boton>
                )}
                <Boton
                  variante="borde"
                  tamano="chico"
                  onClick={() => setConfirmandoRechazo(true)}
                  disabled={guardando}
                  className="border-en-mora-fg/40 text-en-mora-fg hover:bg-en-mora-bg"
                >
                  Rechazar
                </Boton>
              </div>
            )
          )}

          <section className="space-y-3">
            <TituloSeccion>Comprobante</TituloSeccion>
            {!detalle.data?.url_comprobante ? (
              detalle.isPending ? (
                <div className="h-32 animate-pulse rounded-lg bg-muted" />
              ) : (
                <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                  Este pago no tiene comprobante adjunto.
                </p>
              )
            ) : comprobante.isError ? (
              <ErrorConsulta error={comprobante.error} reintento={() => void comprobante.refetch()} />
            ) : comprobante.isPending ? (
              <div className="h-48 animate-pulse rounded-lg bg-muted" />
            ) : (
              <div className="space-y-2">
                {esImagen(detalle.data.url_comprobante) ? (
                  <img
                    src={comprobante.data.url}
                    alt="Comprobante del pago"
                    className="max-h-96 w-full rounded-md border border-border object-contain"
                  />
                ) : (
                  <iframe
                    src={comprobante.data.url}
                    title="Comprobante del pago"
                    className="h-96 w-full rounded-md border border-border"
                  />
                )}
                <a
                  href={comprobante.data.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                >
                  <FileText className="h-4 w-4" aria-hidden="true" />
                  Abrir en otra pestaña
                </a>
              </div>
            )}
          </section>

          <section className="space-y-3">
            <TituloSeccion>Facturación</TituloSeccion>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              <Dato
                etiqueta="Tipo de documento"
                valor={ETIQUETAS_DOCUMENTO_FACTURACION[pago.factura_tipo_documento]}
              />
              <Dato etiqueta="Documento" valor={pago.factura_documento} />
              <Dato etiqueta="Nombre" valor={pago.factura_nombre} className="col-span-2" />
              <Dato etiqueta="Celular" valor={pago.factura_celular ?? ''} />
              <Dato etiqueta="Correo" valor={pago.factura_correo ?? ''} />
              <Dato etiqueta="Observaciones" valor={pago.observaciones ?? ''} className="col-span-2" />
            </dl>
          </section>

          <section className="space-y-3">
            <TituloSeccion>Líneas ({lineas.length})</TituloSeccion>
            {detalle.isError ? (
              <ErrorConsulta error={detalle.error} reintento={() => void detalle.refetch()} />
            ) : detalle.isPending ? (
              <div className="h-24 animate-pulse rounded-lg bg-muted" />
            ) : (
              <ul className="divide-y divide-border">
                {lineas.map((linea) => (
                  <li key={linea.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {afiliados.datos[linea.afiliado_id]?.nombre ??
                          `Afiliado ${linea.afiliado_id.slice(0, 8)}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {ETIQUETAS_CONCEPTO[linea.concepto]} ·{' '}
                        {linea.concepto === 'matricula'
                          ? `enero de ${linea.fecha_cobertura.slice(0, 4)}`
                          : etiquetaMesLarga(linea.fecha_cobertura.slice(0, 7))}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-medium tabular-nums">
                      {formatearDinero(linea.monto)}
                    </span>
                  </li>
                ))}
                {lineas.length === 0 && (
                  <li className="py-3 text-sm text-muted-foreground">
                    Sin líneas de detalle (fueron liberadas al rechazar).
                  </li>
                )}
              </ul>
            )}
          </section>

          {afiliados.isError && (
            <p className="text-xs text-muted-foreground">
              No se pudieron cargar los nombres de los nadadores.{' '}
              <button
                type="button"
                onClick={afiliados.refetch}
                className="font-medium text-primary underline"
              >
                Reintentar
              </button>
            </p>
          )}
        </div>
      </aside>
    </>
  );
}
