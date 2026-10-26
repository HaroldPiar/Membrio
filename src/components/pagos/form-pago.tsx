/**
 * Formulario de registro de pago (Spec del cliente §4.5), página aparte por
 * ser el más complejo del cliente:
 *
 *  - buscar nadador(es) por nombre o documento y elegir varios (una familia
 *    paga varios meses de varios hermanos en un solo pago);
 *  - marcar meses (febrero a diciembre) + matrícula opcional, con valor
 *    sugerido desde el plan (la mensualidad ya viene con el descuento del
 *    afiliado, igual que la cartera del dashboard);
 *  - facturación precargada con el primer nadador elegido, editable;
 *  - comprobante obligatorio por URL firmada (PDF/JPG/PNG/WEBP, máx 10 MB);
 *  - total con decimal.js que SIEMPRE coincide con la suma de las líneas
 *    (se deriva de ellas; la API revalida la igualdad, §5).
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, FileText, Save, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';

import { cn } from '../../lib/cn';
import { ETIQUETAS_DOCUMENTO, type Afiliado } from '../../lib/afiliados-datos';
import { api, procesar } from '../../lib/api';
import { usePlanes } from '../../lib/consultas-afiliados';
import { useAfiliadosDetalle } from '../../lib/consultas-pagos';
import { formatearDinero } from '../../lib/formato';
import {
  ACEPTACION_COMPROBANTE,
  ETIQUETAS_CONCEPTO,
  ETIQUETAS_DOCUMENTO_FACTURACION,
  MESES_COBRABLES,
  NOMBRES_MES,
  aniosRegistro,
  esDineroValido,
  esMimeComprobante,
  esquemaFacturacion,
  facturacionDesdeAfiliado,
  lineasDesde,
  sugerenciasDe,
  totalLineas,
  validarComprobante,
  type SeleccionAfiliado,
  type DatosFacturacion,
  type ValoresFacturacion,
} from '../../lib/pagos-datos';
import { etiquetaMesLarga } from '../../lib/dashboard-datos';
import { Boton } from '../ui/boton';
import { CampoTexto } from '../ui/campo-texto';
import { CampoSeleccion } from '../ui/campo-seleccion';
import { Campo } from '../ui/campo';
import { ErrorConsulta } from '../ui/error-consulta';
import { EstadoVacio } from '../ui/estado-vacio';
import { ProveedorConsultas } from '../ui/proveedor-consultas';
import { Tarjeta, TarjetaContenido, TarjetaEncabezado, TarjetaTitulo } from '../ui/tarjeta';
import { BuscadorAfiliados } from './buscador-afiliados';

const CLASE_ENLACE =
  'inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-colors';

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <h3 className="border-b border-border pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {titulo}
      </h3>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function FormPago({ afiliadoInicial }: { afiliadoInicial: string | null }) {
  return (
    <ProveedorConsultas>
      <ContenidoFormPago afiliadoInicial={afiliadoInicial} />
    </ProveedorConsultas>
  );
}

function ContenidoFormPago({ afiliadoInicial }: { afiliadoInicial: string | null }) {
  const queryClient = useQueryClient();
  const planes = usePlanes();
  const [selecciones, setSelecciones] = useState<SeleccionAfiliado[]>([]);
  const [meses, setMeses] = useState<string[]>([]);
  const [matricula, setMatricula] = useState(false);
  const [anio, setAnio] = useState(() => aniosRegistro()[0]);
  const [comprobante, setComprobante] = useState<File | null>(null);
  const [errorComprobante, setErrorComprobante] = useState<string | null>(null);
  const [errorFormulario, setErrorFormulario] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ValoresFacturacion, unknown, DatosFacturacion>({
    resolver: zodResolver(esquemaFacturacion),
    defaultValues: {
      factura_tipo_documento: 'CC',
      factura_documento: '',
      factura_nombre: '',
      factura_celular: '',
      factura_correo: '',
    },
  });

  const agregar = (afiliado: Afiliado) => {
    const yaElegido = selecciones.some((seleccion) => seleccion.afiliado.id === afiliado.id);
    if (yaElegido) return;
    setSelecciones((previo) => [
      ...previo,
      { afiliado, ...sugerenciasDe(afiliado, planes.data?.datos.find((p) => p.id === afiliado.plan_id)) },
    ]);
    // Precarga de facturación solo con el PRIMER nadador y si el operador
    // no tocó nada todavía (§4.5: precargados pero editables).
    if (selecciones.length === 0 && !isDirty) {
      reset(facturacionDesdeAfiliado(afiliado));
    }
  };

  const quitar = (id: string) =>
    setSelecciones((previo) => previo.filter((seleccion) => seleccion.afiliado.id !== id));

  const setValor = (id: string, campo: 'valorMensual' | 'valorMatricula', valor: string) =>
    setSelecciones((previo) =>
      previo.map((seleccion) =>
        seleccion.afiliado.id === id ? { ...seleccion, [campo]: valor } : seleccion,
      ),
    );

  const toggleMes = (mes: string) =>
    setMeses((previo) =>
      previo.includes(mes) ? previo.filter((valor) => valor !== mes) : [...previo, mes],
    );

  const elegirArchivo = (archivo: File | null) => {
    if (!archivo) {
      setComprobante(null);
      setErrorComprobante(null);
      return;
    }
    const error = validarComprobante(archivo);
    setErrorComprobante(error);
    setComprobante(error ? null : archivo);
  };

  // Enlace de Cartera: /pagos/nuevo?afiliado=<id> preselecciona al deudor.
  const prefill = useAfiliadosDetalle(afiliadoInicial ? [afiliadoInicial] : []);
  const prefillProcesado = useRef(false);
  useEffect(() => {
    if (prefillProcesado.current || !afiliadoInicial || !planes.data) return;
    const afiliado = prefill.datos[afiliadoInicial];
    if (afiliado) {
      prefillProcesado.current = true;
      agregar(afiliado);
      return;
    }
    if (prefill.isError) {
      prefillProcesado.current = true;
      setAviso('No se encontró el nadador indicado. Búscalo por nombre o documento.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- efecto de inicialización
  }, [prefill, planes.data, afiliadoInicial]);

  const lineas = useMemo(
    () => lineasDesde(selecciones, meses, matricula, anio),
    [selecciones, meses, matricula, anio],
  );
  const total = lineas.every((linea) => esDineroValido(linea.monto)) ? totalLineas(lineas) : null;
  const nombresPlanes = new Map((planes.data?.datos ?? []).map((plan) => [plan.id, plan.nombre]));

  const enviar = handleSubmit(async (fact) => {
    setAviso(null);
    setErrorFormulario(null);
    if (selecciones.length === 0) {
      setErrorFormulario('Agrega al menos un nadador para registrar el pago.');
      return;
    }
    if (lineas.length === 0) {
      setErrorFormulario('Marca al menos un mes (febrero a diciembre) o activa la matrícula.');
      return;
    }
    if (selecciones.some((s) => !esDineroValido(s.valorMensual) || !esDineroValido(s.valorMatricula))) {
      setErrorFormulario('Revisa los valores: deben ser montos válidos (ej. 35000).');
      return;
    }
    if (!comprobante) {
      setErrorFormulario('Adjunta el comprobante: PDF, JPG, PNG o WEBP, máximo 10 MB.');
      return;
    }

    try {
      // 1) URL firmada de subida y PUT directo del archivo (§10: el API no
      //    recibe binarios; la ruta devuelta es la que viaja en el body).
      const contenidoTipo = comprobante.type;
      if (!esMimeComprobante(contenidoTipo)) {
        throw new Error('Formato de comprobante no permitido: PDF, JPG, PNG o WEBP.');
      }
      const subida = await procesar(
        api.POST('/api/v1/archivos/subida', {
          body: {
            tipo: 'comprobante',
            contenido_tipo: contenidoTipo,
            tamano_bytes: comprobante.size,
          },
        }),
      );
      const subidaDirecta = await fetch(subida.url, {
        method: 'PUT',
        headers: { 'content-type': contenidoTipo },
        body: comprobante,
      });
      if (!subidaDirecta.ok) {
        throw new Error('No se pudo subir el comprobante. Intenta de nuevo.');
      }

      // 2) Alta del pago: total derivado de las líneas (la API revalida).
      await procesar(
        api.POST('/api/v1/pagos', {
          body: {
            // Mismo cálculo que el total en pantalla: suma decimal de líneas.
            monto_total: totalLineas(lineas),
            factura_tipo_documento: fact.factura_tipo_documento,
            factura_documento: fact.factura_documento,
            factura_nombre: fact.factura_nombre,
            factura_celular: fact.factura_celular?.trim() || null,
            factura_correo: fact.factura_correo?.trim() || null,
            url_comprobante: subida.ruta,
            lineas,
          },
        }),
      );

      await queryClient.invalidateQueries({ queryKey: ['pagos'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      // Nace pendiente: la bandeja de verificación es el destino.
      window.location.assign('/pagos');
    } catch (error) {
      setAviso(error instanceof Error ? error.message : 'No se pudo registrar el pago.');
    }
  });

  if (planes.isError) {
    return <ErrorConsulta error={planes.error} reintento={() => void planes.refetch()} />;
  }
  if (planes.isPending) {
    return (
      <div className="space-y-4">
        {[0, 1, 2].map((n) => (
          <div key={n} className="h-40 animate-pulse rounded-lg border border-border bg-surface" />
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Registrar pago</h1>
        <p className="text-sm text-muted-foreground">
          Elige los nadadores, los meses que cubre y adjunta el comprobante. Nace en estado
          «Pendiente» hasta verificarlo.
        </p>
      </div>

      <Tarjeta>
        <TarjetaEncabezado>
          <TarjetaTitulo>Datos del pago</TarjetaTitulo>
          <p className="text-sm text-muted-foreground">
            Los campos con * son obligatorios. Facturación se precarga con el primer nadador.
          </p>
        </TarjetaEncabezado>
        <TarjetaContenido>
          <form onSubmit={enviar} noValidate className="space-y-6">
            <Seccion titulo="Nadadores">
              <BuscadorAfiliados
                elegidos={selecciones.map((seleccion) => seleccion.afiliado.id)}
                onAgregar={agregar}
              />
              {selecciones.length === 0 ? (
                <EstadoVacio mensaje="Busca por nombre o documento y agrega a quien paga." />
              ) : (
                <div className="space-y-3">
                  {selecciones.map((seleccion) => {
                    const id = seleccion.afiliado.id;
                    const errorMensual = esDineroValido(seleccion.valorMensual)
                      ? undefined
                      : 'Monto inválido (ej. 35000)';
                    const errorMatricula = esDineroValido(seleccion.valorMatricula)
                      ? undefined
                      : 'Monto inválido (ej. 50000)';
                    return (
                      <div key={id} className="rounded-lg border border-border p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{seleccion.afiliado.nombre}</p>
                            <p className="truncate text-xs text-muted-foreground tabular-nums">
                              {ETIQUETAS_DOCUMENTO[seleccion.afiliado.tipo_documento]}{' '}
                              {seleccion.afiliado.numero_documento}
                              {' · '}
                              {nombresPlanes.get(seleccion.afiliado.plan_id) ?? 'Sin plan'}
                            </p>
                          </div>
                          <Boton
                            variante="fantasma"
                            tamano="chico"
                            onClick={() => quitar(id)}
                            aria-label={`Quitar a ${seleccion.afiliado.nombre}`}
                          >
                            <X className="h-3.5 w-3.5" aria-hidden="true" />
                            Quitar
                          </Boton>
                        </div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <Campo id={`mensual-${id}`} etiqueta="Valor de la mensualidad" error={errorMensual}>
                            <CampoTexto
                              id={`mensual-${id}`}
                              inputMode="decimal"
                              autoComplete="off"
                              aria-invalid={errorMensual ? true : undefined}
                              value={seleccion.valorMensual}
                              onChange={(evento) => setValor(id, 'valorMensual', evento.target.value)}
                            />
                          </Campo>
                          <Campo id={`matricula-${id}`} etiqueta="Valor de la matrícula" error={errorMatricula}>
                            <CampoTexto
                              id={`matricula-${id}`}
                              inputMode="decimal"
                              autoComplete="off"
                              aria-invalid={errorMatricula ? true : undefined}
                              value={seleccion.valorMatricula}
                              onChange={(evento) => setValor(id, 'valorMatricula', evento.target.value)}
                            />
                          </Campo>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Seccion>

            <Seccion titulo="Meses que cubre el pago">
              <div className="flex flex-wrap items-end gap-4">
                <Campo id="anio" etiqueta="Año" className="w-32">
                  <CampoSeleccion
                    id="anio"
                    value={String(anio)}
                    onChange={(evento) => setAnio(Number(evento.target.value))}
                  >
                    {aniosRegistro().map((valor) => (
                      <option key={valor} value={valor}>
                        {valor}
                      </option>
                    ))}
                  </CampoSeleccion>
                </Campo>
                <label className="flex cursor-pointer items-center gap-2 pb-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={matricula}
                    onChange={(evento) => setMatricula(evento.target.checked)}
                    className="h-4 w-4 rounded border-border accent-primary"
                  />
                  Matrícula de enero ({anio})
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                {MESES_COBRABLES.map((mes) => {
                  const marcado = meses.includes(mes);
                  return (
                    <button
                      key={mes}
                      type="button"
                      aria-pressed={marcado}
                      onClick={() => toggleMes(mes)}
                      className={cn(
                        'rounded-md border px-3 py-1.5 text-sm transition-colors',
                        marcado
                          ? 'border-primary bg-primary/10 font-medium text-primary'
                          : 'border-border bg-surface hover:bg-muted',
                      )}
                    >
                      {NOMBRES_MES[mes]}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Enero no es facturable: lo cubre la matrícula. Los meses marcados aplican a todos
                los nadadores elegidos.
              </p>
            </Seccion>

            <Seccion titulo="Facturación">
              <div className="grid gap-4 sm:grid-cols-2">
                <Campo
                  id="factura_tipo_documento"
                  etiqueta="Tipo de documento *"
                  error={errors.factura_tipo_documento?.message}
                >
                  <CampoSeleccion
                    id="factura_tipo_documento"
                    aria-invalid={errors.factura_tipo_documento ? true : undefined}
                    {...register('factura_tipo_documento')}
                  >
                    <option value="">— Selecciona un tipo —</option>
                    {Object.entries(ETIQUETAS_DOCUMENTO_FACTURACION).map(([valor, etiqueta]) => (
                      <option key={valor} value={valor}>
                        {etiqueta}
                      </option>
                    ))}
                  </CampoSeleccion>
                </Campo>
                <Campo
                  id="factura_documento"
                  etiqueta="Número de documento *"
                  error={errors.factura_documento?.message}
                >
                  <CampoTexto
                    id="factura_documento"
                    autoComplete="off"
                    placeholder="900123456-1"
                    aria-invalid={errors.factura_documento ? true : undefined}
                    {...register('factura_documento')}
                  />
                </Campo>
                <Campo
                  id="factura_nombre"
                  etiqueta="Nombre o razón social *"
                  error={errors.factura_nombre?.message}
                  className="sm:col-span-2"
                >
                  <CampoTexto
                    id="factura_nombre"
                    autoComplete="off"
                    placeholder="Familia Ramírez"
                    aria-invalid={errors.factura_nombre ? true : undefined}
                    {...register('factura_nombre')}
                  />
                </Campo>
                <Campo id="factura_celular" etiqueta="Celular" error={errors.factura_celular?.message}>
                  <CampoTexto
                    id="factura_celular"
                    inputMode="tel"
                    autoComplete="off"
                    placeholder="Opcional"
                    {...register('factura_celular')}
                  />
                </Campo>
                <Campo id="factura_correo" etiqueta="Correo" error={errors.factura_correo?.message}>
                  <CampoTexto
                    id="factura_correo"
                    type="email"
                    autoComplete="off"
                    placeholder="Opcional"
                    {...register('factura_correo')}
                  />
                </Campo>
              </div>
            </Seccion>

            <Seccion titulo="Comprobante *">
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="file"
                  accept={ACEPTACION_COMPROBANTE}
                  onChange={(evento) => elegirArchivo(evento.target.files?.[0] ?? null)}
                  className="block w-full cursor-pointer rounded-md border border-dashed border-border bg-surface px-3 py-3 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium hover:border-primary/50"
                  aria-invalid={errorComprobante ? true : undefined}
                />
              </div>
              {errorComprobante && (
                <p role="alert" className="text-xs text-error-fg">
                  {errorComprobante}
                </p>
              )}
              {comprobante && (
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <FileText className="h-4 w-4" aria-hidden="true" />
                  {comprobante.name} ({Math.max(1, Math.round(comprobante.size / 1024))} KB)
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                PDF, JPG, PNG o WEBP, máximo 10 MB. Se sube con una URL firmada (§10).
              </p>
            </Seccion>

            <Seccion titulo="Líneas del pago">
              {lineas.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Agrega nadadores y marca meses para ver las líneas.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th scope="col" className="px-3 py-2 text-left">
                          Nadador
                        </th>
                        <th scope="col" className="px-3 py-2 text-left">
                          Concepto
                        </th>
                        <th scope="col" className="px-3 py-2 text-left">
                          Mes de cobertura
                        </th>
                        <th scope="col" className="px-3 py-2 text-right">
                          Monto
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {lineas.map((linea) => {
                        const afiliado = selecciones.find(
                          (seleccion) => seleccion.afiliado.id === linea.afiliado_id,
                        )?.afiliado;
                        return (
                          <tr
                            key={`${linea.afiliado_id}-${linea.concepto}-${linea.fecha_cobertura}`}
                            className="border-b border-border last:border-b-0"
                          >
                            <td className="px-3 py-2">{afiliado?.nombre ?? '—'}</td>
                            <td className="px-3 py-2">{ETIQUETAS_CONCEPTO[linea.concepto]}</td>
                            <td className="px-3 py-2">
                              {linea.concepto === 'matricula'
                                ? `Enero de ${anio}`
                                : etiquetaMesLarga(linea.fecha_cobertura.slice(0, 7))}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {esDineroValido(linea.monto) ? (
                                formatearDinero(linea.monto)
                              ) : (
                                <span className="text-en-mora-fg">{linea.monto || '—'}</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-border pt-4">
                <span className="text-sm font-medium text-muted-foreground">
                  Total ({lineas.length} {lineas.length === 1 ? 'línea' : 'líneas'})
                </span>
                <span className="text-2xl font-semibold tabular-nums">
                  {total !== null ? formatearDinero(total) : '—'}
                </span>
              </div>
            </Seccion>

            {errorFormulario && (
              <p role="alert" className="rounded-md bg-en-mora-bg px-3 py-2 text-sm text-en-mora-fg">
                {errorFormulario}
              </p>
            )}
            {aviso && (
              <p role="alert" className="rounded-md bg-en-mora-bg px-3 py-2 text-sm text-en-mora-fg">
                {aviso}
              </p>
            )}

            <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
              <a
                href="/pagos"
                className={cn(CLASE_ENLACE, 'text-foreground/80 hover:bg-muted')}
                aria-disabled={isSubmitting}
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Cancelar
              </a>
              <Boton type="submit" disabled={isSubmitting}>
                <Save className="h-4 w-4" aria-hidden="true" />
                {isSubmitting ? 'Registrando…' : 'Registrar pago'}
              </Boton>
            </div>
          </form>
        </TarjetaContenido>
      </Tarjeta>
    </div>
  );
}
