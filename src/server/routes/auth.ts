/**
 * Rutas de autenticación (capa routes: solo Zod + llamada al service; sin lógica).
 *
 * POST /api/v1/auth/dev-login — SOLO montada con AUTH_MODE=dev.
 * Body: { correo }. Responde con el token Bearer y el usuario.
 */
import { Hono } from 'hono';
import { z } from 'zod';

import { entorno } from '../config/env';
import { AppError } from '../errors';
import { iniciarSesionDev } from '../services/auth';

const esquemaLogin = z.object({
  correo: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ message: 'Correo inválido' })),
});

export const rutasAuth = new Hono();

if (entorno.AUTH_MODE === 'dev') {
  rutasAuth.post('/dev-login', async (c) => {
    const resultado = esquemaLogin.safeParse(await c.req.json().catch(() => null));
    if (!resultado.success) {
      throw new AppError(400, 'VALIDACION', 'Datos inválidos', resultado.error.issues);
    }
    const sesion = await iniciarSesionDev(resultado.data.correo);
    return c.json(sesion, 200);
  });
}
