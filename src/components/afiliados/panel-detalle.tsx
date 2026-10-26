/**
 * Panel lateral de detalle de un afiliado (Spec del cliente §4.3): datos,
 * acudientes (alta/edición/baja), historial de pagos y la acción Retirar
 * (solo admin — la seguridad es de la API con requerirRol('admin')).
 */
import { useQueryClient } from '@tanstack/react-query';
import { Pencil, UserMinus, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';

import {
  ETIQUETAS_DOCUMENTO,
  fraccionAPorcentaje,
  type Acudiente,
  type Afiliado,
} from '../../lib/afiliados-datos';
import { api, procesar } from '../../lib/api';
import type { Categoria, Eps, Plan } from '../../lib/consultas-afiliados';
import { formatearDinero, formatearFecha, formatearInstante } from '../../lib/formato';
import { useAcudientes, useHistorialPagos } from '../../lib/consultas-afiliados';
import { ErrorConsulta } from '../ui/error-consulta';
import { EstadoPago } from '../ui/estado-pago';
import { Boton } from '../ui/boton';
import { CampoTexto } from '../ui/campo-texto';
import { Campo } from './campo';
import { FormularioAcudiente } from './form-acudiente';

const ESTADOS_PAGO_PAGOS = {
  pendiente: { texto: 'Pendiente', clase: 'bg-por-vencer-bg text-por-vencer-fg' },
  verificado: { texto: 'Verificado', clase: 'bg-al-dia-bg text-al-dia-fg' },
  rechazado: { texto: 'Rechazado', clase: 'bg-en-mora-bg text-en-mora-fg' },
} as const;

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

export function PanelDetalle({
  afiliado,
  planes,
  categorias,
  eps,
  esAdmin,
  onCerrar,
  onEditar,
  onRetirado,
}: {
  afiliado: Afiliado;
  planes: Plan[];
  categorias: Categoria[];
  eps: Eps[];
  esAdmin: boolean;
  onCerrar: () => void;
  onEditar: () => void;
  onRetirado: () => void;
}) {
  const queryClient = useQueryClient();
  const acudientes = useAcudientes(afiliado.id);
  const historial = useHistorialPagos(afiliado.id);
  const [modoAcudiente, setModoAcudiente] = useState<
    { tipo: 'nuevo' } | { tipo: 'editar'; acudiente: Acudiente } | null
  >(null);
  const [confirmandoRetiro, setConfirmandoRetiro] = useState(false);
  const [fechaRetiro, setFechaRetiro] = useState('');
  const [motivoRetiro, setMotivoRetiro] = useState('');
  const [guardandoRetiro, setGuardandoRetiro] = useState(false);
  const [eliminando, setEliminando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  // Escape cierra el panel; el bloqueo de scroll vive en el listado.
  useEffect(() => {
    const alEscapar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') onCerrar();
    };
    document.addEventListener('keydown', alEscapar);
    return () => document.removeEventListener('keydown', alEscapar);
  }, [onCerrar]);

  const nombrePlan = planes.find((plan) => plan.id === afiliado.plan_id)?.nombre;
  const nombreCategoria = categorias.find((categoria) => categoria.id === afiliado.categoria_id)?.nombre;
  const nombreEps = eps.find((entidad) => entidad.id === afiliado.eps_id)?.nombre;

  const confirmarRetiro = async () => {
    setAviso(null);
    setGuardandoRetiro(true);
    try {
      const cuerpo: { fecha_retiro?: string; motivo_retiro?: string } = {};
      if (fechaRetiro) cuerpo.fecha_retiro = fechaRetiro;
      if (motivoRetiro.trim()) cuerpo.motivo_retiro = motivoRetiro.trim();
      await procesar(
        api.POST('/api/v1/afiliados/{id}/retiro', {
          params: { path: { id: afiliado.id } },
          body: cuerpo,
        }),
      );
      await queryClient.invalidateQueries({ queryKey: ['afiliados'] });
      onRetirado();
    } catch (error) {
      setAviso(error instanceof Error ? error.message : 'No se pudo retirar. Intenta de nuevo.');
      setGuardandoRetiro(false);
    }
  };

  const eliminarAcudiente = async (acudiente: Acudiente) => {
    setAviso(null);
    try {
      await procesar(api.DELETE('/api/v1/acudientes/{id}', { params: { path: { id: acudiente.id } } }));
      await queryClient.invalidateQueries({ queryKey: ['afiliados', 'acudientes'] });
      setEliminando(null);
    } catch (error) {
      setAviso(error instanceof Error ? error.message : 'No se pudo eliminar. Intenta de nuevo.');
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onCerrar} aria-hidden="true" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Detalle de ${afiliado.nombre}`}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col bg-surface shadow-xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-border p-4">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold">{afiliado.nombre}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {ETIQUETAS_DOCUMENTO[afiliado.tipo_documento]} {afiliado.numero_documento}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <EstadoPago estado={afiliado.estado_pago} />
              {!afiliado.activo && (
                <span className="inline-flex rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                  Retirado
                </span>
              )}
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

          {confirmandoRetiro ? (
            <div className="space-y-3 rounded-lg border border-en-mora-fg/40 bg-en-mora-bg p-4">
              <p className="text-sm font-semibold text-en-mora-fg">Retirar a {afiliado.nombre}</p>
              <p className="text-xs text-en-mora-fg">
                Pasa a «Retirado» (borrado lógico): conserva el historial de pagos y deja de contar en
                los estados de pago.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Campo id="retiro-fecha" etiqueta="Fecha de retiro (hoy si se deja vacía)">
                  <CampoTexto
                    id="retiro-fecha"
                    type="date"
                    value={fechaRetiro}
                    onChange={(evento) => setFechaRetiro(evento.target.value)}
                  />
                </Campo>
                <Campo id="retiro-motivo" etiqueta="Motivo (opcional)" className="sm:col-span-2">
                  <textarea
                    id="retiro-motivo"
                    value={motivoRetiro}
                    onChange={(evento) => setMotivoRetiro(evento.target.value)}
                    maxLength={500}
                    rows={2}
                    className="flex w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </Campo>
              </div>
              <div className="flex justify-end gap-2">
                <Boton
                  variante="fantasma"
                  tamano="chico"
                  onClick={() => setConfirmandoRetiro(false)}
                  disabled={guardandoRetiro}
                >
                  Cancelar
                </Boton>
                <Boton tamano="chico" onClick={() => void confirmarRetiro()} disabled={guardandoRetiro}>
                  {guardandoRetiro ? 'Retirando…' : 'Confirmar retiro'}
                </Boton>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <Boton variante="borde" tamano="chico" onClick={onEditar}>
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                Editar
              </Boton>
              {esAdmin && afiliado.activo && (
                <Boton
                  variante="borde"
                  tamano="chico"
                  onClick={() => setConfirmandoRetiro(true)}
                  className="border-en-mora-fg/40 text-en-mora-fg hover:bg-en-mora-bg"
                >
                  <UserMinus className="h-3.5 w-3.5" aria-hidden="true" />
                  Retirar
                </Boton>
              )}
            </div>
          )}

          <section className="space-y-3">
            <TituloSeccion>Datos</TituloSeccion>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              <Dato etiqueta="Plan" valor={nombrePlan ?? ''} />
              <Dato etiqueta="Categoría" valor={nombreCategoria ?? ''} />
              <Dato etiqueta="Celular" valor={afiliado.celular} />
              <Dato etiqueta="Correo" valor={afiliado.correo} />
              <Dato etiqueta="Fecha de nacimiento" valor={formatearFecha(afiliado.fecha_nacimiento)} />
              <Dato etiqueta="Género" valor={afiliado.genero ?? ''} />
              <Dato etiqueta="EPS" valor={nombreEps ?? ''} />
              <Dato etiqueta="Tipo de sangre" valor={afiliado.tipo_sangre} />
              <Dato etiqueta="Dirección" valor={afiliado.direccion ?? ''} className="col-span-2" />
              <Dato etiqueta="Fecha de ingreso" valor={formatearFecha(afiliado.fecha_ingreso)} />
              <Dato etiqueta="Descuento" valor={fraccionAPorcentaje(afiliado.descuento)} />
              <Dato etiqueta="Medio de captación" valor={afiliado.medio_captacion ?? ''} />
              <Dato
                etiqueta="Consentimiento"
                valor={afiliado.fecha_consentimiento ? formatearFecha(afiliado.fecha_consentimiento) : ''}
              />
              {afiliado.fecha_retiro && (
                <>
                  <Dato etiqueta="Fecha de retiro" valor={formatearFecha(afiliado.fecha_retiro)} />
                  <Dato etiqueta="Motivo de retiro" valor={afiliado.motivo_retiro ?? ''} />
                </>
              )}
            </dl>
          </section>

          <section className="space-y-3">
            <TituloSeccion>Acudientes</TituloSeccion>
            {acudientes.isError ? (
              <ErrorConsulta
                error={acudientes.error}
                reintento={() => void acudientes.refetch()}
              />
            ) : acudientes.isPending ? (
              <div className="h-16 animate-pulse rounded-lg bg-muted" />
            ) : (
              <>
                <ul className="divide-y divide-border">
                  {acudientes.data.map((acudiente) => (
                    <li key={acudiente.id} className="py-2.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {acudiente.nombre}
                            {acudiente.es_principal && (
                              <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">
                                Principal
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {acudiente.numero_documento}
                            {acudiente.celular ? ` · ${acudiente.celular}` : ''}
                            {acudiente.correo ? ` · ${acudiente.correo}` : ''}
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <Boton
                            variante="fantasma"
                            tamano="chico"
                            onClick={() => setModoAcudiente({ tipo: 'editar', acudiente })}
                          >
                            Editar
                          </Boton>
                          <Boton
                            variante="fantasma"
                            tamano="chico"
                            onClick={() => setEliminando(acudiente.id)}
                            className="text-en-mora-fg"
                          >
                            Eliminar
                          </Boton>
                        </div>
                      </div>
                      {eliminando === acudiente.id && (
                        <div className="mt-2 flex items-center justify-end gap-2 rounded-md bg-en-mora-bg px-3 py-2 text-xs">
                          <span className="text-en-mora-fg">¿Eliminar este acudiente?</span>
                          <Boton
                            variante="fantasma"
                            tamano="chico"
                            onClick={() => setEliminando(null)}
                          >
                            No
                          </Boton>
                          <Boton
                            tamano="chico"
                            onClick={() => void eliminarAcudiente(acudiente)}
                            className="bg-en-mora-fg text-white hover:bg-en-mora-fg/90"
                          >
                            Sí, eliminar
                          </Boton>
                        </div>
                      )}
                    </li>
                  ))}
                  {acudientes.data.length === 0 && (
                    <li className="py-3 text-sm text-muted-foreground">Sin acudientes registrados.</li>
                  )}
                </ul>

                {modoAcudiente ? (
                  <FormularioAcudiente
                    afiliadoId={afiliado.id}
                    acudiente={modoAcudiente.tipo === 'editar' ? modoAcudiente.acudiente : null}
                    onListo={() => setModoAcudiente(null)}
                    onCancelar={() => setModoAcudiente(null)}
                  />
                ) : (
                  <Boton
                    variante="borde"
                    tamano="chico"
                    onClick={() => setModoAcudiente({ tipo: 'nuevo' })}
                  >
                    Agregar acudiente
                  </Boton>
                )}
              </>
            )}
          </section>

          <section className="space-y-3">
            <TituloSeccion>Historial de pagos</TituloSeccion>
            {historial.isError ? (
              <ErrorConsulta error={historial.error} reintento={() => void historial.refetch()} />
            ) : historial.isPending ? (
              <div className="h-16 animate-pulse rounded-lg bg-muted" />
            ) : historial.data.datos.length === 0 ? (
              <p className="py-3 text-sm text-muted-foreground">Sin pagos registrados.</p>
            ) : (
              <ul className="divide-y divide-border">
                {historial.data.datos.map((pago) => {
                  const estado = ESTADOS_PAGO_PAGOS[pago.estado];
                  return (
                    <li key={pago.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm font-medium tabular-nums">
                          {formatearDinero(pago.monto_total)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatearInstante(pago.created_at)}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${estado.clase}`}
                      >
                        {estado.texto}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </aside>
    </>
  );
}
