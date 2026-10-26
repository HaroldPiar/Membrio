/**
 * Formulario de /login (Spec del cliente §4.1). En AUTH_MODE=dev pide solo el
 * correo (lo que acepta dev-login) y lleva la franja "Modo desarrollo"; con
 * Supabase aquí entrarán correo y contraseña.
 *
 * Errores GENÉRICOS: jamás revela si el correo existe (la API ya responde 401
 * idéntico para cuentas inexistentes o inactivas). No usa `procesar` porque su
 * redirección automática de 401 recargaría esta misma página y perdería lo
 * escrito: aquí cualquier fallo se muestra en un aviso.
 *
 * El dev-login fija la cookie httpOnly `membrio_session` en la respuesta; el
 * cliente no guarda ningún token.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { FlaskConical } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { api } from '../../lib/api';
import { inicioSesionSchema, type InicioSesion } from '../../shared/sesion';
import { Boton } from './boton';
import { CampoTexto } from './campo-texto';
import { Etiqueta } from './etiqueta';
import { Tarjeta, TarjetaContenido, TarjetaEncabezado, TarjetaTitulo } from './tarjeta';

export function LoginForm() {
  const [aviso, setAviso] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<InicioSesion>({
    resolver: zodResolver(inicioSesionSchema),
    defaultValues: { correo: '' },
  });

  const enviar = handleSubmit(async (datos) => {
    setAviso(null);
    try {
      const { response } = await api.POST('/api/v1/auth/dev-login', { body: datos });
      if (response.ok) {
        window.location.assign('/');
        return;
      }
      setAviso('No se pudo iniciar sesión. Revisa el correo e inténtalo de nuevo.');
    } catch {
      setAviso('Sin conexión con el servidor. Intenta de nuevo en un momento.');
    }
  });

  return (
    <Tarjeta className="overflow-hidden">
      <div className="flex items-center gap-2 bg-por-vencer-bg px-4 py-2 text-xs font-medium text-por-vencer-fg">
        <FlaskConical className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Modo desarrollo: se entra solo con el correo, sin contraseña.
      </div>
      <TarjetaEncabezado>
        <TarjetaTitulo className="text-2xl">Iniciar sesión</TarjetaTitulo>
        <p className="text-sm text-muted-foreground">Entra a Membrio con tu correo de usuario.</p>
      </TarjetaEncabezado>
      <TarjetaContenido>
        <form onSubmit={enviar} noValidate className="space-y-4">
          <div className="space-y-2">
            <Etiqueta htmlFor="correo">Correo</Etiqueta>
            <CampoTexto
              id="correo"
              type="email"
              autoComplete="email"
              placeholder="admin@truchas.test"
              aria-invalid={errors.correo ? true : undefined}
              aria-describedby={errors.correo ? 'correo-error' : undefined}
              {...register('correo')}
            />
            {errors.correo && (
              <p id="correo-error" role="alert" className="text-xs text-error-fg">
                {errors.correo.message}
              </p>
            )}
          </div>
          {aviso && (
            <p role="alert" className="rounded-md bg-en-mora-bg px-3 py-2 text-sm text-en-mora-fg">
              {aviso}
            </p>
          )}
          <Boton type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Entrando…' : 'Entrar'}
          </Boton>
        </form>
      </TarjetaContenido>
    </Tarjeta>
  );
}
