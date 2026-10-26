/**
 * Formulario de alta y edición de afiliados (Spec del cliente §4.3) por
 * secciones: identificación, contacto y salud, plan y curso, y —solo en el
 * alta— acudiente. La validación es el esquema compartido de `src/shared`
 * (`esquemaFormularioAfiliado`): misma regla de documento, mismos límites.
 *
 * Los opcionales vacíos llegan como null al wire: `setValueAs` normaliza ''
 * al cambiar (si no, '' rompería el uuid del schema) y el cuerpo manda
 * `?? null` (borra el dato en edición, lo deja vacío en el alta).
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';

import {
  ETIQUETAS_DOCUMENTO,
  acudienteConContenido,
  acudienteParaEnviar,
  esquemaFormularioAfiliado,
  valoresAlta,
  valoresEdicion,
  type Afiliado,
  type DatosFormularioAfiliado,
  type ValoresFormularioAfiliado,
} from '../../lib/afiliados-datos';
import { api, procesar } from '../../lib/api';
import type { Categoria, Eps, Plan } from '../../lib/consultas-afiliados';
import { TIPOS_DOCUMENTO } from '../../shared/documento';
import { tipoSangreSchema } from '../../shared/afiliados';
import { Boton } from '../ui/boton';
import { CampoTexto } from '../ui/campo-texto';
import { CampoSeleccion } from '../ui/campo-seleccion';
import { Tarjeta, TarjetaContenido, TarjetaEncabezado, TarjetaTitulo } from '../ui/tarjeta';
import { Campo } from '../ui/campo';

const TIPOS_SANGRE = tipoSangreSchema.options;
const vacioANulo = (valor: string) => (valor === '' ? null : valor);

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <h3 className="border-b border-border pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {titulo}
      </h3>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export function FormularioAfiliado({
  afiliado,
  planes,
  categorias,
  eps,
  onCancelar,
  onListo,
}: {
  /** null = alta; con afiliado = edición (el bloque de acudiente no aplica). */
  afiliado: Afiliado | null;
  planes: Plan[];
  categorias: Categoria[];
  eps: Eps[];
  onCancelar: () => void;
  onListo: (guardado: Afiliado) => void;
}) {
  const queryClient = useQueryClient();
  const [aviso, setAviso] = useState<string | null>(null);
  const esEdicion = afiliado !== null;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ValoresFormularioAfiliado, unknown, DatosFormularioAfiliado>({
    resolver: zodResolver(esquemaFormularioAfiliado),
    defaultValues: esEdicion ? valoresEdicion(afiliado) : valoresAlta(),
  });

  const enviar = handleSubmit(async (datos) => {
    setAviso(null);
    try {
      const { acudiente, ...resto } = datos;
      const cuerpo = {
        ...resto,
        eps_id: resto.eps_id ?? null,
        genero: resto.genero ?? null,
        medio_captacion: resto.medio_captacion ?? null,
        direccion: resto.direccion ?? null,
        fecha_consentimiento: resto.fecha_consentimiento ?? null,
      };

      let guardado: Afiliado;
      if (esEdicion && afiliado) {
        guardado = await procesar(
          api.PATCH('/api/v1/afiliados/{id}', { params: { path: { id: afiliado.id } }, body: cuerpo }),
        );
      } else {
        guardado = await procesar(api.POST('/api/v1/afiliados', { body: cuerpo }));
        if (acudiente && acudienteConContenido(acudiente)) {
          try {
            await procesar(
              api.POST('/api/v1/afiliados/{id}/acudientes', {
                params: { path: { id: guardado.id } },
                body: acudienteParaEnviar(acudiente),
              }),
            );
          } catch (errorAcudiente) {
            // El afiliado ya existe: se avisa sin deshacer el alta.
            setAviso(
              `Afiliado creado, pero el acudiente no se pudo guardar: ${
                errorAcudiente instanceof Error ? errorAcudiente.message : 'error inesperado'
              }`,
            );
          }
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['afiliados'] });
      onListo(guardado);
    } catch (error) {
      setAviso(error instanceof Error ? error.message : 'No se pudo guardar. Intenta de nuevo.');
    }
  });

  return (
    <Tarjeta>
      <TarjetaEncabezado>
        <TarjetaTitulo>{esEdicion ? 'Editar afiliado' : 'Nuevo afiliado'}</TarjetaTitulo>
        <p className="text-sm text-muted-foreground">
          {esEdicion
            ? 'Actualiza los datos; el retiro se hace desde el panel de detalle.'
            : 'Los campos con * son obligatorios. El acudiente es opcional.'}
        </p>
      </TarjetaEncabezado>
      <TarjetaContenido>
        <form onSubmit={enviar} noValidate className="space-y-6">
          <Seccion titulo="Identificación">
            <Campo id="tipo_documento" etiqueta="Tipo de documento" error={errors.tipo_documento?.message}>
              <CampoSeleccion id="tipo_documento" {...register('tipo_documento')}>
                {TIPOS_DOCUMENTO.map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {ETIQUETAS_DOCUMENTO[tipo]}
                  </option>
                ))}
              </CampoSeleccion>
            </Campo>
            <Campo id="numero_documento" etiqueta="Número de documento *" error={errors.numero_documento?.message}>
              <CampoTexto
                id="numero_documento"
                inputMode="numeric"
                autoComplete="off"
                placeholder="1002345678"
                aria-invalid={errors.numero_documento ? true : undefined}
                {...register('numero_documento')}
              />
            </Campo>
            <Campo id="nombre" etiqueta="Nombre completo *" error={errors.nombre?.message} className="sm:col-span-2">
              <CampoTexto
                id="nombre"
                autoComplete="off"
                placeholder="Sofía Ramírez"
                aria-invalid={errors.nombre ? true : undefined}
                {...register('nombre')}
              />
            </Campo>
            <Campo id="fecha_nacimiento" etiqueta="Fecha de nacimiento *" error={errors.fecha_nacimiento?.message}>
              <CampoTexto
                id="fecha_nacimiento"
                type="date"
                aria-invalid={errors.fecha_nacimiento ? true : undefined}
                {...register('fecha_nacimiento')}
              />
            </Campo>
            <Campo id="genero" etiqueta="Género" error={errors.genero?.message}>
              <CampoTexto
                id="genero"
                autoComplete="off"
                placeholder="Opcional"
                {...register('genero', { setValueAs: vacioANulo })}
              />
            </Campo>
          </Seccion>

          <Seccion titulo="Contacto y salud">
            <Campo id="celular" etiqueta="Celular *" error={errors.celular?.message}>
              <CampoTexto
                id="celular"
                inputMode="tel"
                autoComplete="off"
                placeholder="3001234567"
                aria-invalid={errors.celular ? true : undefined}
                {...register('celular')}
              />
            </Campo>
            <Campo id="correo" etiqueta="Correo" error={errors.correo?.message}>
              <CampoTexto
                id="correo"
                type="email"
                autoComplete="off"
                placeholder="familia@ejemplo.com"
                {...register('correo')}
              />
            </Campo>
            <Campo id="direccion" etiqueta="Dirección" error={errors.direccion?.message} className="sm:col-span-2">
              <CampoTexto
                id="direccion"
                autoComplete="off"
                {...register('direccion', { setValueAs: vacioANulo })}
              />
            </Campo>
            <Campo id="eps_id" etiqueta="EPS" error={errors.eps_id?.message}>
              <CampoSeleccion id="eps_id" {...register('eps_id', { setValueAs: vacioANulo })}>
                <option value="">Sin EPS</option>
                {eps.map((entidad) => (
                  <option key={entidad.id} value={entidad.id}>
                    {entidad.nombre}
                  </option>
                ))}
              </CampoSeleccion>
            </Campo>
            <Campo id="tipo_sangre" etiqueta="Tipo de sangre" error={errors.tipo_sangre?.message}>
              <CampoSeleccion id="tipo_sangre" {...register('tipo_sangre')}>
                {TIPOS_SANGRE.map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {tipo}
                  </option>
                ))}
              </CampoSeleccion>
            </Campo>
          </Seccion>

          <Seccion titulo="Plan y curso">
            <Campo id="plan_id" etiqueta="Plan *" error={errors.plan_id?.message}>
              <CampoSeleccion id="plan_id" aria-invalid={errors.plan_id ? true : undefined} {...register('plan_id')}>
                <option value="">— Selecciona un plan —</option>
                {planes.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.nombre}
                  </option>
                ))}
              </CampoSeleccion>
            </Campo>
            <Campo id="categoria_id" etiqueta="Categoría (curso) *" error={errors.categoria_id?.message}>
              <CampoSeleccion
                id="categoria_id"
                aria-invalid={errors.categoria_id ? true : undefined}
                {...register('categoria_id')}
              >
                <option value="">— Selecciona una categoría —</option>
                {categorias.map((categoria) => (
                  <option key={categoria.id} value={categoria.id}>
                    {categoria.nombre}
                  </option>
                ))}
              </CampoSeleccion>
            </Campo>
            <Campo id="fecha_ingreso" etiqueta="Fecha de ingreso *" error={errors.fecha_ingreso?.message}>
              <CampoTexto
                id="fecha_ingreso"
                type="date"
                aria-invalid={errors.fecha_ingreso ? true : undefined}
                {...register('fecha_ingreso')}
              />
            </Campo>
            <Campo id="descuento" etiqueta="Descuento (fracción 0 a 1)" error={errors.descuento?.message}>
              <CampoTexto id="descuento" inputMode="decimal" placeholder="0" {...register('descuento')} />
            </Campo>
            <Campo id="medio_captacion" etiqueta="Medio de captación" error={errors.medio_captacion?.message}>
              <CampoTexto
                id="medio_captacion"
                autoComplete="off"
                placeholder="Opcional"
                {...register('medio_captacion', { setValueAs: vacioANulo })}
              />
            </Campo>
            <Campo
              id="fecha_consentimiento"
              etiqueta="Fecha de consentimiento"
              error={errors.fecha_consentimiento?.message}
            >
              <CampoTexto
                id="fecha_consentimiento"
                type="date"
                {...register('fecha_consentimiento', { setValueAs: vacioANulo })}
              />
            </Campo>
          </Seccion>

          {!esEdicion && (
            <Seccion titulo="Acudiente (opcional)">
              <Campo
                id="acudiente_numero_documento"
                etiqueta="Documento del acudiente"
                error={errors.acudiente?.numero_documento?.message}
              >
                <CampoTexto
                  id="acudiente_numero_documento"
                  autoComplete="off"
                  {...register('acudiente.numero_documento')}
                />
              </Campo>
              <Campo id="acudiente_nombre" etiqueta="Nombre del acudiente" error={errors.acudiente?.nombre?.message}>
                <CampoTexto id="acudiente_nombre" autoComplete="off" {...register('acudiente.nombre')} />
              </Campo>
              <Campo id="acudiente_celular" etiqueta="Celular del acudiente" error={errors.acudiente?.celular?.message}>
                <CampoTexto id="acudiente_celular" inputMode="tel" autoComplete="off" {...register('acudiente.celular')} />
              </Campo>
              <Campo id="acudiente_correo" etiqueta="Correo del acudiente" error={errors.acudiente?.correo?.message}>
                <CampoTexto id="acudiente_correo" type="email" autoComplete="off" {...register('acudiente.correo')} />
              </Campo>
            </Seccion>
          )}

          {aviso && (
            <p role="alert" className="rounded-md bg-en-mora-bg px-3 py-2 text-sm text-en-mora-fg">
              {aviso}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
            <Boton variante="fantasma" onClick={onCancelar} disabled={isSubmitting}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Cancelar
            </Boton>
            <Boton type="submit" disabled={isSubmitting}>
              <Save className="h-4 w-4" aria-hidden="true" />
              {isSubmitting ? 'Guardando…' : 'Guardar'}
            </Boton>
          </div>
        </form>
      </TarjetaContenido>
    </Tarjeta>
  );
}
