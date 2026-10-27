/**
 * Pestaña Usuarios de /admin (Spec del cliente §4.6): alta, cambio de rol
 * en línea y activar/desactivar cuentas. El guard por rol es de la API
 * (403): acá solo se replica la regla de negocio que SÍ cambia la interfaz
 * — la fila propia no ofrece desactivar porque el API responde 409.
 *
 * Se listan activos e inactivos (sin filtros): los inactivos se necesitan
 * para poder reactivarlos.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { UserPlus } from 'lucide-react';
import { Fragment, useState } from 'react';
import { useForm } from 'react-hook-form';

import {
  OPCIONES_ROL,
  esquemaUsuario,
  usuarioVacio,
  type DatosUsuario,
  type Rol,
  type ValoresUsuario,
} from '../../lib/admin-datos';
import { api, procesar } from '../../lib/api';
import { useUsuarios, type Usuario } from '../../lib/consultas-admin';
import { useSesion } from '../../lib/sesion';
import { Boton } from '../ui/boton';
import { Campo } from '../ui/campo';
import { CampoSeleccion } from '../ui/campo-seleccion';
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

/** Alta de usuario (correo, nombre y rol) — esquema de la capa pura. */
function FormularioUsuario({ onCancelar, onListo }: { onCancelar: () => void; onListo: () => void }) {
  const queryClient = useQueryClient();
  const [aviso, setAviso] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ValoresUsuario, unknown, DatosUsuario>({
    resolver: zodResolver(esquemaUsuario),
    defaultValues: usuarioVacio(),
  });

  const enviar = handleSubmit(async (datos) => {
    setAviso(null);
    try {
      await procesar(api.POST('/api/v1/usuarios', { body: datos }));
      await queryClient.invalidateQueries({ queryKey: ['admin'] });
      onListo();
    } catch (error) {
      // p. ej. 409: el correo ya existe en otra organización.
      setAviso(avisoDeError(error, 'No se pudo crear el usuario.'));
    }
  });

  return (
    <Tarjeta>
      <TarjetaEncabezado>
        <TarjetaTitulo>Nuevo usuario</TarjetaTitulo>
      </TarjetaEncabezado>
      <TarjetaContenido className="space-y-4">
        {aviso && (
          <p role="alert" className="rounded-md bg-en-mora-bg px-3 py-2 text-sm text-en-mora-fg">
            {aviso}
          </p>
        )}
        <form onSubmit={enviar} noValidate className="grid gap-4 sm:grid-cols-2">
          <Campo id="correo" etiqueta="Correo *" error={errors.correo?.message}>
            <CampoTexto
              id="correo"
              type="email"
              autoComplete="off"
              placeholder="operador@club.test"
              aria-invalid={errors.correo ? true : undefined}
              {...register('correo')}
            />
          </Campo>
          <Campo id="nombre" etiqueta="Nombre completo *" error={errors.nombre?.message}>
            <CampoTexto
              id="nombre"
              autoComplete="off"
              placeholder="Ana Pérez"
              aria-invalid={errors.nombre ? true : undefined}
              {...register('nombre')}
            />
          </Campo>
          <Campo id="rol" etiqueta="Rol *" error={errors.rol?.message}>
            <CampoSeleccion id="rol" aria-invalid={errors.rol ? true : undefined} {...register('rol')}>
              <option value="">— Selecciona —</option>
              {OPCIONES_ROL.map((opcion) => (
                <option key={opcion.valor} value={opcion.valor}>
                  {opcion.etiqueta}
                </option>
              ))}
            </CampoSeleccion>
          </Campo>
          <div className="flex items-end justify-end gap-2 sm:col-span-2">
            <Boton variante="borde" onClick={onCancelar} disabled={isSubmitting}>
              Cancelar
            </Boton>
            <Boton type="submit" disabled={isSubmitting}>
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              {isSubmitting ? 'Creando…' : 'Crear usuario'}
            </Boton>
          </div>
        </form>
      </TarjetaContenido>
    </Tarjeta>
  );
}

export function TabUsuarios() {
  const queryClient = useQueryClient();
  const usuarios = useUsuarios();
  const sesion = useSesion();
  const [creando, setCreando] = useState(false);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const refrescar = async () => {
    await queryClient.invalidateQueries({ queryKey: ['admin'] });
  };

  const cambiarRol = async (usuario: Usuario, rol: Rol) => {
    setAviso(null);
    setOcupado(usuario.id);
    try {
      await procesar(
        api.PATCH('/api/v1/usuarios/{id}', {
          params: { path: { id: usuario.id } },
          body: { rol },
        }),
      );
    } catch (error) {
      setAviso(avisoDeError(error, 'No se pudo cambiar el rol.'));
    } finally {
      // También tras un error: el refresco restaura el valor del select.
      await refrescar();
      setOcupado(null);
    }
  };

  const cambiarActivo = async (usuario: Usuario, activo: boolean) => {
    setAviso(null);
    setOcupado(usuario.id);
    try {
      if (activo) {
        await procesar(
          api.PATCH('/api/v1/usuarios/{id}', {
            params: { path: { id: usuario.id } },
            body: { activo: true },
          }),
        );
      } else {
        await procesar(
          api.DELETE('/api/v1/usuarios/{id}', { params: { path: { id: usuario.id } } }),
        );
      }
      setConfirmando(null);
    } catch (error) {
      setAviso(avisoDeError(error, 'No se pudo actualizar el estado del usuario.'));
    } finally {
      await refrescar();
      setOcupado(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Cuentas con acceso a Membrio. Desactivar quita el acceso sin borrar el histórico.
        </p>
        {!creando && (
          <Boton onClick={() => setCreando(true)}>
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            Nuevo usuario
          </Boton>
        )}
      </div>

      {aviso && (
        <p role="alert" className="rounded-md bg-en-mora-bg px-3 py-2 text-sm text-en-mora-fg">
          {aviso}
        </p>
      )}

      {creando && (
        <FormularioUsuario onCancelar={() => setCreando(false)} onListo={() => setCreando(false)} />
      )}

      {usuarios.isError ? (
        <ErrorConsulta error={usuarios.error} reintento={() => void usuarios.refetch()} />
      ) : usuarios.isPending ? (
        <EsqueletoListado />
      ) : usuarios.data.datos.length === 0 ? (
        <EstadoVacio mensaje="Aún no hay usuarios: crea la primera cuenta con «Nuevo usuario»." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th scope="col" className="px-3 py-2.5 text-left">
                  Nombre
                </th>
                <th scope="col" className="px-3 py-2.5 text-left">
                  Correo
                </th>
                <th scope="col" className="px-3 py-2.5 text-left">
                  Rol
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
              {usuarios.data.datos.map((usuario) => {
                const esPropio = usuario.id === sesion.data?.id;
                const enConfirmando = confirmando === usuario.id;
                return (
                  <Fragment key={usuario.id}>
                    <tr className="border-b border-border">
                    <td className="max-w-48 px-3 py-2.5">
                      <p className="truncate font-medium">{usuario.nombre}</p>
                      {esPropio && (
                        <p className="text-xs text-muted-foreground">Tu cuenta</p>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">{usuario.correo}</td>
                    <td className="px-3 py-2.5">
                      <CampoSeleccion
                        aria-label={`Rol de ${usuario.nombre}`}
                        className="h-9 w-40"
                        value={usuario.rol}
                        disabled={ocupado === usuario.id}
                        onChange={(evento) => void cambiarRol(usuario, evento.target.value as Rol)}
                      >
                        {OPCIONES_ROL.map((opcion) => (
                          <option key={opcion.valor} value={opcion.valor}>
                            {opcion.etiqueta}
                          </option>
                        ))}
                      </CampoSeleccion>
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={
                          usuario.activo
                            ? 'rounded bg-al-dia-bg px-1.5 py-0.5 text-[11px] font-medium text-al-dia-fg'
                            : 'rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground'
                        }
                      >
                        {usuario.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {esPropio ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : usuario.activo ? (
                        <Boton
                          variante="borde"
                          tamano="chico"
                          disabled={ocupado === usuario.id}
                          onClick={() => setConfirmando(enConfirmando ? null : usuario.id)}
                        >
                          Desactivar
                        </Boton>
                      ) : (
                        <Boton
                          variante="borde"
                          tamano="chico"
                          disabled={ocupado === usuario.id}
                          onClick={() => void cambiarActivo(usuario, true)}
                        >
                          Reactivar
                        </Boton>
                      )}
                    </td>
                    </tr>
                    {enConfirmando && (
                      <tr className="border-b border-border bg-muted/40 last:border-b-0">
                        <td colSpan={5} className="px-3 py-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="text-sm">
                              Al desactivar, {usuario.nombre} perderá el acceso a Membrio. Podrás
                              reactivarla después.
                            </p>
                            <div className="flex gap-2">
                              <Boton
                                tamano="chico"
                                disabled={ocupado === usuario.id}
                                onClick={() => void cambiarActivo(usuario, false)}
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
