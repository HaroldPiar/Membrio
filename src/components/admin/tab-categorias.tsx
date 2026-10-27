/**
 * Pestaña Categorías de /admin (Spec del cliente §4.6): alta y edición del
 * nombre de los cursos. Igual que planes, la baja es ONE-WAY por contrato
 * (`categoriaActualizacionSchema` no acepta `activa`, decisión 44): el copy
 * de confirmación lo advierte y el hueco está anotado en §6.
 *
 * Ojo con el nombre del flag: en este modelo es `activa` (femenino), a
 * diferencia de `activo` en usuarios y planes.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus } from 'lucide-react';
import { Fragment, useState } from 'react';
import { useForm } from 'react-hook-form';

import {
  categoriaVacia,
  esquemaCategoria,
  type DatosCategoria,
  type ValoresCategoria,
} from '../../lib/admin-datos';
import { api, procesar } from '../../lib/api';
import { useCategorias, type Categoria } from '../../lib/consultas-afiliados';
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

/** Alta o edición del nombre de una categoría (mismo formulario). */
function FormularioCategoria({
  categoria,
  onCancelar,
  onListo,
}: {
  /** null = alta; con categoría = edición del nombre. */
  categoria: Categoria | null;
  onCancelar: () => void;
  onListo: () => void;
}) {
  const queryClient = useQueryClient();
  const [aviso, setAviso] = useState<string | null>(null);
  const esEdicion = categoria !== null;
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ValoresCategoria, unknown, DatosCategoria>({
    resolver: zodResolver(esquemaCategoria),
    defaultValues: categoria ? { nombre: categoria.nombre } : categoriaVacia(),
  });

  const enviar = handleSubmit(async (datos) => {
    setAviso(null);
    try {
      if (categoria) {
        await procesar(
          api.PATCH('/api/v1/categorias/{id}', {
            params: { path: { id: categoria.id } },
            body: datos,
          }),
        );
      } else {
        await procesar(api.POST('/api/v1/categorias', { body: datos }));
      }
      await queryClient.invalidateQueries({ queryKey: ['afiliados'] });
      onListo();
    } catch (error) {
      // p. ej. 409: ya existe una categoría con ese nombre en la organización.
      setAviso(avisoDeError(error, 'No se pudo guardar la categoría.'));
    }
  });

  return (
    <Tarjeta>
      <TarjetaEncabezado>
        <TarjetaTitulo>{esEdicion ? 'Editar categoría' : 'Nueva categoría'}</TarjetaTitulo>
      </TarjetaEncabezado>
      <TarjetaContenido className="space-y-4">
        {aviso && (
          <p role="alert" className="rounded-md bg-en-mora-bg px-3 py-2 text-sm text-en-mora-fg">
            {aviso}
          </p>
        )}
        <form onSubmit={enviar} noValidate className="grid gap-4 sm:grid-cols-2">
          <Campo id="nombre" etiqueta="Nombre *" error={errors.nombre?.message}>
            <CampoTexto
              id="nombre"
              autoComplete="off"
              placeholder="Sub-10 Mariposa"
              aria-invalid={errors.nombre ? true : undefined}
              {...register('nombre')}
            />
          </Campo>
          <div className="flex items-end justify-end gap-2">
            <Boton variante="borde" onClick={onCancelar} disabled={isSubmitting}>
              Cancelar
            </Boton>
            <Boton type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando…' : esEdicion ? 'Guardar cambios' : 'Crear categoría'}
            </Boton>
          </div>
        </form>
      </TarjetaContenido>
    </Tarjeta>
  );
}

export function TabCategorias() {
  const queryClient = useQueryClient();
  const categorias = useCategorias();
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<Categoria | null>(null);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const cerrarFormulario = () => {
    setCreando(false);
    setEditando(null);
  };

  const desactivar = async (categoria: Categoria) => {
    setAviso(null);
    setOcupado(categoria.id);
    try {
      await procesar(
        api.DELETE('/api/v1/categorias/{id}', { params: { path: { id: categoria.id } } }),
      );
      setConfirmando(null);
    } catch (error) {
      setAviso(avisoDeError(error, 'No se pudo desactivar la categoría.'));
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
          Cursos o grupos donde se inscriben los nadadores (p. ej. «Sub-10 Mariposa»).
        </p>
        {!abierto && (
          <Boton
            onClick={() => {
              setEditando(null);
              setCreando(true);
            }}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Nueva categoría
          </Boton>
        )}
      </div>

      {aviso && (
        <p role="alert" className="rounded-md bg-en-mora-bg px-3 py-2 text-sm text-en-mora-fg">
          {aviso}
        </p>
      )}

      {abierto && (
        <FormularioCategoria
          key={editando?.id ?? 'nueva'}
          categoria={editando}
          onCancelar={cerrarFormulario}
          onListo={cerrarFormulario}
        />
      )}

      {categorias.isError ? (
        <ErrorConsulta error={categorias.error} reintento={() => void categorias.refetch()} />
      ) : categorias.isPending ? (
        <EsqueletoListado />
      ) : categorias.data.datos.length === 0 ? (
        <EstadoVacio mensaje="Aún no hay categorías: crea la primera con «Nueva categoría»." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th scope="col" className="px-3 py-2.5 text-left">
                  Nombre
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
              {categorias.data.datos.map((categoria) => {
                const enConfirmando = confirmando === categoria.id;
                return (
                  <Fragment key={categoria.id}>
                    <tr className="border-b border-border">
                      <td className="px-3 py-2.5 font-medium">{categoria.nombre}</td>
                      <td className="px-3 py-2.5">
                        <span
                          className={
                            categoria.activa
                              ? 'rounded bg-al-dia-bg px-1.5 py-0.5 text-[11px] font-medium text-al-dia-fg'
                              : 'rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground'
                          }
                        >
                          {categoria.activa ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {categoria.activa ? (
                          <div className="flex items-center justify-end gap-2">
                            <Boton
                              variante="borde"
                              tamano="chico"
                              disabled={ocupado === categoria.id}
                              onClick={() => {
                                setCreando(false);
                                setEditando(categoria);
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                              Editar
                            </Boton>
                            <Boton
                              variante="borde"
                              tamano="chico"
                              disabled={ocupado === categoria.id}
                              onClick={() => setConfirmando(enConfirmando ? null : categoria.id)}
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
                        <td colSpan={3} className="px-3 py-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="text-sm">
                              Se desactivará «{categoria.nombre}». Los nadadores ya inscritos la
                              conservan en su histórico, pero{' '}
                              <strong>no podrás reactivarla desde la aplicación</strong>.
                            </p>
                            <div className="flex gap-2">
                              <Boton
                                tamano="chico"
                                disabled={ocupado === categoria.id}
                                onClick={() => void desactivar(categoria)}
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
