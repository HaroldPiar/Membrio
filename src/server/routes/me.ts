/**
 * GET /api/v1/me (spec §9): el usuario autenticado, su rol y su organización.
 * Sirve además como prueba de la cadena de auth: token → usuario → contexto.
 */
import { Hono } from 'hono';

import type { EnvAplicacion } from '../middleware/auth';
import { contextoDe, requerirAuth } from '../middleware/auth';
import { resumenUsuario } from '../services/auth';
import { obtenerUsuarioPorId } from '../repositories/usuarios';
import { AppError } from '../errors';

export const rutaMe = new Hono<EnvAplicacion>();

rutaMe.use('*', requerirAuth);

rutaMe.get('/', async (c) => {
  const contexto = contextoDe(c);
  const usuario = await obtenerUsuarioPorId(contexto.usuarioId);
  if (!usuario) {
    // No debería pasar: requerirAuth ya lo cargó. Defensa ante carreras (borrado entre medio).
    throw new AppError(401, 'SESION_INVALIDA', 'Usuario inexistente');
  }
  return c.json(resumenUsuario(usuario), 200);
});
