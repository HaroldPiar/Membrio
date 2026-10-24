/**
 * GET/POST /api/v1/usuarios, GET/PATCH/DELETE /api/v1/usuarios/:id (spec §9).
 * CRUD completo SOLO admin (matriz §4). DELETE es baja lógica (activo=false):
 * no se borra la fila (hay auditoría de pagos que la referencia).
 */
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';

import type { EnvAplicacion } from '../middleware/auth';
import { contextoDe, requerirAuth, requerirRol } from '../middleware/auth';
import * as servicio from '../services/catalogos';
import { serializar } from '../../shared/casing';
import { respuestasError } from '../../shared/errores';
import {
  usuarioActualizacionSchema,
  usuarioCreacionSchema,
  usuarioSchema,
} from '../../shared/usuarios';
import {
  decodificarCursor,
  limiteConDetras,
  paginar,
  paginacionQuerySchema,
  respuestaPaginadaSchema,
} from '../../shared/paginacion';

const soloAdmin = { middleware: [requerirRol('admin')] };

const queryListar = paginacionQuerySchema.extend({
  activo: z.coerce.boolean().optional(),
});
const listado = respuestaPaginadaSchema(usuarioSchema);
const idParams = z.object({ id: z.uuid() });

const rutaListar = createRoute({
  method: 'get',
  path: '/api/v1/usuarios',
  summary: 'Lista los usuarios de la organización (solo admin)',
  ...soloAdmin,
  request: { query: queryListar },
  responses: {
    200: { description: 'Página de usuarios', content: { 'application/json': { schema: listado } } },
    ...respuestasError(400, 401, 403),
  },
});

const rutaCrear = createRoute({
  method: 'post',
  path: '/api/v1/usuarios',
  summary: 'Crea un usuario en la organización (solo admin)',
  ...soloAdmin,
  request: {
    body: { content: { 'application/json': { schema: usuarioCreacionSchema } }, required: true },
  },
  responses: {
    201: { description: 'Usuario creado', content: { 'application/json': { schema: usuarioSchema } } },
    ...respuestasError(400, 401, 403, 409, 422),
  },
});

const rutaObtener = createRoute({
  method: 'get',
  path: '/api/v1/usuarios/{id}',
  summary: 'Obtiene un usuario por id (solo admin)',
  ...soloAdmin,
  request: { params: idParams },
  responses: {
    200: { description: 'Usuario', content: { 'application/json': { schema: usuarioSchema } } },
    ...respuestasError(400, 401, 403, 404),
  },
});

const rutaActualizar = createRoute({
  method: 'patch',
  path: '/api/v1/usuarios/{id}',
  summary: 'Actualiza nombre, rol o activo de un usuario (solo admin)',
  ...soloAdmin,
  request: {
    params: idParams,
    body: { content: { 'application/json': { schema: usuarioActualizacionSchema } }, required: true },
  },
  responses: {
    200: { description: 'Usuario actualizado', content: { 'application/json': { schema: usuarioSchema } } },
    ...respuestasError(400, 401, 403, 404, 409, 422),
  },
});

const rutaDesactivar = createRoute({
  method: 'delete',
  path: '/api/v1/usuarios/{id}',
  summary: 'Desactiva un usuario — baja lógica, solo admin',
  ...soloAdmin,
  request: { params: idParams },
  responses: {
    200: { description: 'Usuario desactivado', content: { 'application/json': { schema: usuarioSchema } } },
    ...respuestasError(400, 401, 403, 404, 409),
  },
});

export const rutasUsuarios = new OpenAPIHono<EnvAplicacion>();

rutasUsuarios.use('/api/v1/usuarios/*', requerirAuth);

rutasUsuarios.openapi(rutaListar, async (c) => {
  const q = c.req.valid('query');
  const filas = await servicio.listarUsuarios(contextoDe(c), {
    cursor: decodificarCursor(q.cursor),
    limit: limiteConDetras(q.limit),
    activo: q.activo,
  });
  return c.json(serializar(listado, paginar(filas, q.limit, (f) => f.nombre)), 200);
});

rutasUsuarios.openapi(rutaCrear, async (c) => {
  const creado = await servicio.crearUsuario(contextoDe(c), c.req.valid('json'));
  return c.json(serializar(usuarioSchema, creado), 201);
});

rutasUsuarios.openapi(rutaObtener, async (c) => {
  const usuario = await servicio.obtenerUsuario(contextoDe(c), c.req.valid('param').id);
  return c.json(serializar(usuarioSchema, usuario), 200);
});

rutasUsuarios.openapi(rutaActualizar, async (c) => {
  const usuario = await servicio.actualizarUsuario(
    contextoDe(c),
    c.req.valid('param').id,
    c.req.valid('json'),
  );
  return c.json(serializar(usuarioSchema, usuario), 200);
});

rutasUsuarios.openapi(rutaDesactivar, async (c) => {
  const usuario = await servicio.desactivarUsuario(contextoDe(c), c.req.valid('param').id);
  return c.json(serializar(usuarioSchema, usuario), 200);
});
