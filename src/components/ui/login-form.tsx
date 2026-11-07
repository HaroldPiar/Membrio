/**
 * Formulario de /login (Spec del cliente §4.1).
 *
 * - AUTH_MODE=dev: pide solo el correo (lo que acepta dev-login) y lleva la
 *   franja "Modo desarrollo"; con Supabase aquí entrarán correo y contraseña.
 * - AUTH_MODE=password: pide correo + contraseña y llama a `POST /api/v1/auth/login`
 *   (recién montada solo en este modo). No muestra la franja "Modo desarrollo".
 *
 * Errores GENÉRICOS: jamás revela si el correo existe (la API ya responde 401
 * idéntico para cuentas inexistentes o inactivas). No usa `procesar` porque su
 * redirección automática de 401 recargaría esta misma página y perdería lo
 * escrito: aquí cualquier fallo se muestra en un aviso.
 *
 * El login fija la cookie httpOnly `membrio_session` en la respuesta; el
 * cliente no guarda ningún token.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { FlaskConical } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { api } from '../../lib/api';
import {
  inicioSesionPasswordSchema,
  inicioSesionSchema,
  type InicioSesion,
  type InicioSesionPassword,
} from '../../shared/sesion';
import { Boton } from './boton';
import { CampoTexto } from './campo-texto';
import { Etiqueta } from './etiqueta';
import { Tarjeta, TarjetaContenido, TarjetaEncabezado, TarjetaTitulo } from './tarjeta';

function LoginDev() {
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

function LoginPassword() {
  const [aviso, setAviso] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<InicioSesionPassword>({
    resolver: zodResolver(inicioSesionPasswordSchema),
    defaultValues: { correo: '', password: '' },
  });

  const enviar = handleSubmit(async (datos) => {
    setAviso(null);
    try {
      const { response } = await api.POST('/api/v1/auth/login', { body: datos });
      if (response.ok) {
        window.location.assign('/');
        return;
      }
      const cuerpo = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
      setAviso(
        response.status === 429
          ? 'Demasiados intentos fallidos. Esperá unos minutos antes de reintentar.'
          : (cuerpo?.error?.message ?? 'No se pudo iniciar sesión. Revisa el correo y la contraseña e inténtalo de nuevo.'),
      );
    } catch {
      setAviso('Sin conexión con el servidor. Intenta de nuevo en un momento.');
    }
  });

  return (
    <Tarjeta className="overflow-hidden">
      <TarjetaEncabezado>
        <TarjetaTitulo className="text-2xl">Iniciar sesión</TarjetaTitulo>
        <p className="text-sm text-muted-foreground">Entra a Membrio con tu correo y contraseña.</p>
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
          <div className="space-y-2">
            <Etiqueta htmlFor="password">Contraseña</Etiqueta>
            <CampoTexto
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••••••"
              aria-invalid={errors.password ? true : undefined}
              aria-describedby={errors.password ? 'password-error' : undefined}
              {...register('password')}
            />
            {errors.password && (
              <p id="password-error" role="alert" className="text-xs text-error-fg">
                {errors.password.message}
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

/**
 * Login del cliente web. `modo` viene del servidor (entorno.AUTH_MODE) y solo
 * nombra la variante; ningún secreto viaja al cliente.
 */
export function LoginForm({ modo }: { modo: 'dev' | 'password' | 'supabase' }) {
  if (modo === 'password') {
    return <LoginPassword />;
  }
  // AUTH_MODE=dev (y el modo supabase, pendiente de su propia UI): dev-login.
  return <LoginDev />;
}
