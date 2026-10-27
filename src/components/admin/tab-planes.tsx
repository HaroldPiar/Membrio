/**
 * Pestaña Planes de /admin (Spec del cliente §4.6): alta y edición de los
 * valores de mensualidad y matrícula (los montos viajan como cadenas
 * decimales, sin aritmética en el cliente).
 *
 * La baja es ONE-WAY por contrato: `planActualizacionSchema` no acepta
 * `activo` y DELETE solo pone `activo=false` (decisión 44) — el copy de
 * confirmación lo dice explícitamente y el hueco está anotado en §6.
 * La reactivación solo existiría por SQL directo.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus } from 'lucide-react';
import { Fragment, useState } from 'react';
import { useForm } from 'react-hook-form';

import {
  esquemaPlan,
  planValores,
  planVacio,
  type DatosPlan,
  type ValoresPlan,
} from '../../lib/admin-datos';
import { api, procesar } from '../../lib/api';
import { usePlanes, type Plan } from '../../lib/consultas-afiliados';
import { formatearDinero } from '../../lib/formato';
import { Boton } from '../ui/boton';
import { Campo } from '../ui/campo';
import { CampoTexto } from '../ui/campo-texto';
import { ErrorConsulta } from '../ui/error-consulta';
import { EstadoVacio } from '../ui/estado-vacio';
import { Tarjeta, TarjetaContenido, TarjetaEncabezado, TarjetaTitulo } from '../ui/tarjeta';

const avisoDeError = (error: unknown, porDefecto: string) =>
  error instanceof Error ? error.message : porDefecto;

function EsqueletoListado() {
  return (
    <div className="space-y-2">
      {[0, 1, 2].map((n) => (
        <div key={n} className="h-12 animate-pulse rounded-lg border border-border bg-surface" />
      ))}
    </div>
  );
}

/** Alta o edición de un plan (mismo formulario, cambia el envío). */
function FormularioPlan({
  plan,
  onCancelar,
  onListo,
}: {
  /** null = alta; con plan = edición de sus valores. */
  plan: Plan | null;
  onCancelar: () => void;
  onListo: () => void;
}) {
  const queryClient = useQueryClient();
  const [aviso, setAviso] = useState<string | null>(null);
  const esEdicion = plan !== null;
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ValoresPlan, unknown, DatosPlan>({
    resolver: zodResolver(esquemaPlan),
    defaultValues: plan ? planValores(plan) : planVacio(),
  });

  const enviar = handleSubmit(async (datos) => {
    setAviso(null);
    try {
      if (plan) {
        await procesar(
          api.PATCH('/api/v1/planes/{id}', {
            params: { path: { id: plan.id } },
            body: datos,
          }),
        );
      } else {
        await procesar(api.POST('/api/v1/planes', { body: datos }));
      }
      // Los planes viven en el caché de Fase 3: invalidarlo refresca también
      // los selectores de /afiliados y /pagos/nuevo.
      await queryClient.invalidateQueries({ queryKey: ['afiliados'] });
      onListo();
    } catch (error) {
      // p. ej. 409: ya existe un plan con ese nombre en la organización.
      setAviso(avisoDeError(error, 'No se pudo guardar el plan.'));
    }
  });

  return (
    <Tarjeta>
      <TarjetaEncabezado>
        <TarjetaTitulo>{esEdicion ? 'Editar plan' : 'Nuevo plan'}</TarjetaTitulo>
      </TarjetaEncabezado>
      <TarjetaContenido className="space-y-4">
        {aviso && (
          <p role="alert" className="rounded-md bg-en-mora-bg px-3 py-2 text-sm text-en-mora-fg">
            {aviso}
          </p>
        )}
        <form onSubmit={enviar} noValidate className="grid gap-4 sm:grid-cols-3">
          <Campo id="nombre" etiqueta="Nombre *" error={errors.nombre?.message}>
            <CampoTexto
              id="nombre"
              autoComplete="off"
              placeholder="Básico"
              aria-invalid={errors.nombre ? true : undefined}
              {...register('nombre')}
            />
          </Campo>
          <Campo id="valor_mensualidad" etiqueta="Mensualidad * (COP)" error={errors.valor_mensualidad?.message}>
            <CampoTexto
              id="valor_mensualidad"
              inputMode="decimal"
              placeholder="74000.00"
              aria-invalid={errors.valor_mensualidad ? true : undefined}
              {...register('valor_mensualidad')}
            />
          </Campo>
          <Campo id="valor_matricula" etiqueta="Matrícula * (COP)" error={errors.valor_matricula?.message}>
            <CampoTexto
              id="valor_matricula"
              inputMode="decimal"
              placeholder="80000.00"
              aria-invalid={errors.valor_matricula ? true : undefined}
              {...register('valor_matricula')}
            />
          </Campo>
          <div className="flex items-end justify-end gap-2 sm:col-span-3">
            <Boton variante="borde" onClick={onCancelar} disabled={isSubmitting}>
              Cancelar
            </Boton>
            <Boton type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando…' : esEdicion ? 'Guardar cambios' : 'Crear plan'}
            </Boton>
          </div>
        </form>
      </TarjetaContenido>
    </Tarjeta>
  );
}

export function TabPlanes() {
  const queryClient = useQueryClient();
  const planes = usePlanes();
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<Plan | null>(null);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const cerrarFormulario = () => {
    setCreando(false);
    setEditando(null);
  };

  const desactivar = async (plan: Plan) => {
    setAviso(null);
    setOcupado(plan.id);
    try {
      await procesar(api.DELETE('/api/v1/planes/{id}', { params: { path: { id: plan.id } } }));
      setConfirmando(null);
    } catch (error) {
      setAviso(avisoDeError(error, 'No se pudo desactivar el plan.'));
    } finally {
      await queryClient.invalidateQueries({ queryKey: ['afiliados'] });
      setOcupado(null);
    }
  };

  const abierto = creando || editando !== null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Valores de mensualidad y matrícula que usan el formulario de pagos y la cartera.
        </p>
        {!abierto && (
          <Boton
            onClick={() => {
              setEditando(null);
              setCreando(true);
            }}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Nuevo plan
          </Boton>
        )}
      </div>

      {aviso && (
        <p role="alert" className="rounded-md bg-en-mora-bg px-3 py-2 text-sm text-en-mora-fg">
          {aviso}
        </p>
      )}

      {abierto && (
        <FormularioPlan
          key={editando?.id ?? 'nueva'}
          plan={editando}
          onCancelar={cerrarFormulario}
          onListo={cerrarFormulario}
        />
      )}

      {planes.isError ? (
        <ErrorConsulta error={planes.error} reintento={() => void planes.refetch()} />
      ) : planes.isPending ? (
        <EsqueletoListado />
      ) : planes.data.datos.length === 0 ? (
        <EstadoVacio mensaje="Aún no hay planes: crea el primero con «Nuevo plan»." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th scope="col" className="px-3 py-2.5 text-left">
                  Nombre
                </th>
                <th scope="col" className="px-3 py-2.5 text-right">
                  Mensualidad
                </th>
                <th scope="col" className="px-3 py-2.5 text-right">
                  Matrícula
                </th>
                <th scope="col" className="px-3 py-2.5 text-left">
                  Estado
                </th>
                <th scope="col" className="px-3 py-2.5 text-right">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {planes.data.datos.map((plan) => {
                const enConfirmando = confirmando === plan.id;
                return (
                  <Fragment key={plan.id}>
                    <tr className="border-b border-border">
                      <td className="px-3 py-2.5 font-medium">{plan.nombre}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
                        {formatearDinero(plan.valor_mensualidad)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
                        {formatearDinero(plan.valor_matricula)}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={
                            plan.activo
                              ? 'rounded bg-al-dia-bg px-1.5 py-0.5 text-[11px] font-medium text-al-dia-fg'
                              : 'rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground'
                          }
                        >
                          {plan.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {plan.activo ? (
                          <div className="flex items-center justify-end gap-2">
                            <Boton
                              variante="borde"
                              tamano="chico"
                              disabled={ocupado === plan.id}
                              onClick={() => {
                                setCreando(false);
                                setEditando(plan);
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                              Editar
                            </Boton>
                            <Boton
                              variante="borde"
                              tamano="chico"
                              disabled={ocupado === plan.id}
                              onClick={() => setConfirmando(enConfirmando ? null : plan.id)}
                            >
                              Desactivar
                            </Boton>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Sin reactivación desde la app
                          </span>
                        )}
                      </td>
                    </tr>
                    {enConfirmando && (
                      <tr className="border-b border-border bg-muted/40 last:border-b-0">
                        <td colSpan={5} className="px-3 py-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="text-sm">
                              Se desactivará «{plan.nombre}». Los pagos históricos lo conservan,
                              pero <strong>no podrás reactivarlo desde la aplicación</strong>.
                            </p>
                            <div className="flex gap-2">
                              <Boton
                                tamano="chico"
                                disabled={ocupado === plan.id}
                                onClick={() => void desactivar(plan)}
                              >
                                Sí, desactivar
                              </Boton>
                              <Boton
                                variante="fantasma"
                                tamano="chico"
                                onClick={() => setConfirmando(null)}
                              >
                                Cancelar
                              </Boton>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
