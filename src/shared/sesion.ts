/**
 * Esquema de inicio de sesión compartido por el cliente.
 *
 * Espejo de `esquemaLogin` en src/server/routes/auth.ts: el backend NO se
 * tocó para esto (solo el Paso 0 habilitó cambios de API). Decisión anotada
 * en el Spec del cliente §7: unificar en src/shared cuando auth vuelva a
 * modificarse.
 */
import { z } from '@hono/zod-openapi';

export const inicioSesionSchema = z.object({
  correo: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ message: 'Correo inválido' })),
});

export type InicioSesion = z.infer<typeof inicioSesionSchema>;

/**
 * Inicio de sesión con correo + contraseña (AUTH_MODE=password). Espejo de
 * `esquemaInicioSesionPassword` en src/server/routes/auth.ts: el backend NO se
 * tocó para esto (solo el Paso 0 habilitó cambios de API). Decisión anotada
 * en el Spec del cliente §7: unificar en src/shared cuando auth vuelva a
 * modificarse.
 */
export const inicioSesionPasswordSchema = z.object({
  correo: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ message: 'Correo inválido' })),
  password: z
    .string()
    .min(12, { message: 'La contraseña debe tener al menos 12 caracteres' })
    .max(128, { message: 'La contraseña debe tener hasta 128 caracteres' }),
});

export type InicioSesionPassword = z.infer<typeof inicioSesionPasswordSchema>;

/**
 * Cambio de contraseña self-service (task: admin asigna temporal → usuario
 * cambia). Espejo del `esquemaCambioPassword` en src/server/routes/auth.ts:
 * política 12–128 y nueva distinta de la actual (validada en el handler).
 */
export const cambioContrasenaSchema = z.object({
  contrasena_actual: z
    .string()
    .min(12, { message: 'La contraseña debe tener al menos 12 caracteres' })
    .max(128, { message: 'La contraseña debe tener hasta 128 caracteres' }),
  contrasena_nueva: z
    .string()
    .min(12, { message: 'La contraseña debe tener al menos 12 caracteres' })
    .max(128, { message: 'La contraseña debe tener hasta 128 caracteres' }),
});

export type CambioContrasena = z.infer<typeof cambioContrasenaSchema>;
