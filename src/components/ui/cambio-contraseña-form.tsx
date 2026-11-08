/**
 * Formulario de cambio de contraseña self-service (task: admin asigna temporal
 * → el usuario autenticado cambia desde el menú).
 *
 * - Política: 12–128 caracteres (misma que la API, espejo en src/shared/sesion).
 * - La nueva debe ser distinta de la actual y coincidir con la confirmación.
 * - Errores GENÉRICOS: jamás revela detalles del fallo (la API responde 401
 *   CREDENCIALES_INVALIDAS si la actual no matchea, pero el aviso es genérico).
 * - Al éxito: el backend emitió un JWT nuevo y reemplazó la cookie; redirigimos
 *   a `/` (el claim `dcp` pasa a false).
 */
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { api } from '../../lib/api';
import { cambioContrasenaSchema, type CambioContrasena } from '../../shared/sesion';
import { Boton } from './boton';
import { CampoPassword } from './campo-password';
import { Etiqueta } from './etiqueta';
import { Tarjeta, TarjetaContenido, TarjetaEncabezado, TarjetaTitulo } from './tarjeta';

type DatosCambio = CambioContrasena & { contrasena_nueva_confirmar: string };

const VALORES_INICIALES: DatosCambio = {
  contrasena_actual: '',
  contrasena_nueva: '',
  contrasena_nueva_confirmar: '',
};

export function CambioContrasena() {
  const [aviso, setAviso] = useState<string | null>(null);
  const [errorValidacion, setErrorValidacion] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<DatosCambio>({
    defaultValues: VALORES_INICIALES,
  });

  const enviar = handleSubmit(async (datos) => {
    setAviso(null);
    setErrorValidacion(null);
    const validacion = cambioContrasenaSchema.safeParse({
      contrasena_actual: datos.contrasena_actual,
      contrasena_nueva: datos.contrasena_nueva,
    });
    if (!validacion.success) {
      setErrorValidacion(validacion.error.issues[0]?.message ?? 'Revisa los datos e inténtalo de nuevo.');
      return;
    }
    if (datos.contrasena_nueva !== datos.contrasena_nueva_confirmar) {
      setErrorValidacion('Las nuevas contraseñas no coinciden.');
      return;
    }
    if (datos.contrasena_nueva === datos.contrasena_actual) {
      setErrorValidacion('La nueva contraseña debe ser distinta de la actual.');
      return;
    }
    try {
      const { response } = await api.POST('/api/v1/auth/cambio-password', {
        body: { contrasena_actual: datos.contrasena_actual, contrasena_nueva: datos.contrasena_nueva },
      });
      if (response.ok) {
        window.location.assign('/');
        return;
      }
      const cuerpo = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
      setAviso(
        response.status === 429
          ? 'Demasiados intentos fallidos. Esperá unos minutos antes de reintentar.'
          : (cuerpo?.error?.message ?? 'No se pudo cambiar la contraseña. Revisa los datos e inténtalo de nuevo.'),
      );
    } catch {
      setAviso('Sin conexión con el servidor. Intenta de nuevo en un momento.');
    }
  });

  return (
    <Tarjeta className="overflow-hidden">
      <TarjetaEncabezado>
        <TarjetaTitulo className="text-2xl">Cambiar contraseña</TarjetaTitulo>
        <p className="text-sm text-muted-foreground">
          Ingresa tu contraseña actual y una nueva de al menos 12 caracteres.
        </p>
      </TarjetaEncabezado>
      <TarjetaContenido>
        <form onSubmit={enviar} noValidate className="space-y-4">
          <div className="space-y-2">
            <Etiqueta htmlFor="contrasena_actual">Contraseña actual</Etiqueta>
            <CampoPassword
              id="contrasena_actual"
              autoComplete="current-password"
              placeholder="••••••••••••"
              {...register('contrasena_actual')}
            />
          </div>
          <div className="space-y-2">
            <Etiqueta htmlFor="contrasena_nueva">Nueva contraseña</Etiqueta>
            <CampoPassword
              id="contrasena_nueva"
              autoComplete="new-password"
              placeholder="••••••••••••"
              {...register('contrasena_nueva')}
            />
          </div>
          <div className="space-y-2">
            <Etiqueta htmlFor="contrasena_nueva_confirmar">Confirmar nueva contraseña</Etiqueta>
            <CampoPassword
              id="contrasena_nueva_confirmar"
              autoComplete="new-password"
              placeholder="••••••••••••"
              {...register('contrasena_nueva_confirmar')}
            />
          </div>
          {errorValidacion && (
            <p role="alert" className="rounded-md bg-en-mora-bg px-3 py-2 text-sm text-en-mora-fg">
              {errorValidacion}
            </p>
          )}
          {aviso && (
            <p role="alert" className="rounded-md bg-en-mora-bg px-3 py-2 text-sm text-en-mora-fg">
              {aviso}
            </p>
          )}
          <Boton type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Guardando…' : 'Cambiar contraseña'}
          </Boton>
        </form>
      </TarjetaContenido>
    </Tarjeta>
  );
}
