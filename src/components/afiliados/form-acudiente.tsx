/**
 * Formulario de un acudiente dentro del panel de detalle: alta (POST) y
 * edición (PATCH) con los esquemas compartidos de `src/shared/acudientes`.
 * Un solo esquema para ambos modos — la actualización acepta campos
 * parciales, así que el alta simplemente manda todo.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { Check, X } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import type { Acudiente } from '../../lib/afiliados-datos';
import { api, procesar } from '../../lib/api';
import { acudienteActualizacionSchema } from '../../shared/acudientes';
import { Boton } from '../ui/boton';
import { CampoTexto } from '../ui/campo-texto';
import { Campo } from './campo';
import type { z } from '@hono/zod-openapi';

type ValoresAcudienteForm = z.input<typeof acudienteActualizacionSchema>;

export function FormularioAcudiente({
  afiliadoId,
  acudiente,
  onListo,
  onCancelar,
}: {
  afiliadoId: string;
  /** null = alta; con acudiente = edición. */
  acudiente: Acudiente | null;
  onListo: () => void;
  onCancelar: () => void;
}) {
  const queryClient = useQueryClient();
  const [aviso, setAviso] = useState<string | null>(null);
  const esEdicion = acudiente !== null;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ValoresAcudienteForm>({
    resolver: zodResolver(acudienteActualizacionSchema),
    defaultValues: esEdicion
      ? {
          numero_documento: acudiente.numero_documento,
          nombre: acudiente.nombre,
          celular: acudiente.celular ?? '',
          correo: acudiente.correo ?? '',
          es_principal: acudiente.es_principal,
        }
      : { numero_documento: '', nombre: '', celular: '', correo: '', es_principal: false },
  });

  const enviar = handleSubmit(async (valores) => {
    setAviso(null);
    // Los campos son opcionales en el schema (edición parcial): el `?? ''`
    // es solo para el tipo — en runtime el formulario siempre manda valores
    // y la validación compartida ya exigió documento y nombre.
    const cuerpo = {
      numero_documento: (valores.numero_documento ?? '').trim(),
      nombre: (valores.nombre ?? '').trim(),
      celular: valores.celular?.trim() || null,
      correo: valores.correo?.trim() || null,
      es_principal: valores.es_principal ?? false,
    };
    try {
      if (esEdicion && acudiente) {
        await procesar(api.PATCH('/api/v1/acudientes/{id}', {
          params: { path: { id: acudiente.id } },
          body: cuerpo,
        }));
      } else {
        await procesar(api.POST('/api/v1/afiliados/{id}/acudientes', {
          params: { path: { id: afiliadoId } },
          body: cuerpo,
        }));
      }
      await queryClient.invalidateQueries({ queryKey: ['afiliados', 'acudientes'] });
      onListo();
    } catch (error) {
      setAviso(error instanceof Error ? error.message : 'No se pudo guardar. Intenta de nuevo.');
    }
  });

  return (
    <form onSubmit={enviar} noValidate className="space-y-4 rounded-lg border border-border bg-muted/40 p-4">
      <p className="text-sm font-medium">{esEdicion ? 'Editar acudiente' : 'Agregar acudiente'}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          id="acudiente-doc"
          etiqueta="Número de documento *"
          error={errors.numero_documento?.message}
        >
          <CampoTexto
            id="acudiente-doc"
            autoComplete="off"
            aria-invalid={errors.numero_documento ? true : undefined}
            {...register('numero_documento')}
          />
        </Campo>
        <Campo id="acudiente-nombre" etiqueta="Nombre *" error={errors.nombre?.message}>
          <CampoTexto
            id="acudiente-nombre"
            autoComplete="off"
            aria-invalid={errors.nombre ? true : undefined}
            {...register('nombre')}
          />
        </Campo>
        <Campo id="acudiente-celular" etiqueta="Celular" error={errors.celular?.message}>
          <CampoTexto id="acudiente-celular" inputMode="tel" autoComplete="off" {...register('celular')} />
        </Campo>
        <Campo id="acudiente-correo" etiqueta="Correo" error={errors.correo?.message}>
          <CampoTexto id="acudiente-correo" type="email" autoComplete="off" {...register('correo')} />
        </Campo>
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" className="h-4 w-4 accent-[var(--primary)]" {...register('es_principal')} />
        Es el acudiente principal
      </label>

      {aviso && (
        <p role="alert" className="rounded-md bg-en-mora-bg px-3 py-2 text-sm text-en-mora-fg">
          {aviso}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Boton variante="fantasma" tamano="chico" onClick={onCancelar} disabled={isSubmitting}>
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          Cancelar
        </Boton>
        <Boton type="submit" tamano="chico" disabled={isSubmitting}>
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
          {isSubmitting ? 'Guardando…' : 'Guardar'}
        </Boton>
      </div>
    </form>
  );
}
