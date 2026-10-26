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
