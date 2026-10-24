/**
 * Acudientes (spec §9):
 *   GET/POST /api/v1/afiliados/{id}/acudientes
 *   PATCH/DELETE /api/v1/acudientes/{id}
 * Admin y operador (matriz §4: "Crear y editar afiliados y acudientes").
 * DELETE es físico: los pagos no referencian acudientes (snapshot en pagos).
 */
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';

import type { EnvAplicacion } from '../middleware/auth';
import { contextoDe, requerirAuth } from '../middleware/auth';
import * as servicio from '../services/acudientes';
import { aCamel, serializar } from '../../shared/casing';
import { acudienteActualizacionSchema, acudienteCreacionSchema, acudienteSchema } from '../../shared/acudientes';
import { respuestasError } from '../../shared/errores';

const idParams = z.object({ id: z.uuid() });

const rutaListar = createRoute({
  method: 'get',
  path: '/api/v1/afiliados/{id}/acudientes',
  summary: 'Lista los acudientes de un afiliado',
  request: { params: idParams },
  responses: {
    200: {
      description: 'Acudientes del afiliado',
      content: { 'application/json': { schema: z.array(acudienteSchema) } },
    },
    ...respuestasError(400, 401, 404),
  },
});

const rutaCrear = createRoute({
  method: 'post',
  path: '/api/v1/afiliados/{id}/acudientes',
  summary: 'Agrega un acudiente al afiliado (admin y operador)',
  request: {
    params: idParams,
    body: { content: { 'application/json': { schema: acudienteCreacionSchema } }, required: true },
  },
  responses: {
    201: { description: 'Acudiente creado', content: { 'application/json': { schema: acudienteSchema } } },
    ...respuestasError(400, 401, 404, 409),
  },
});

const rutaActualizar = createRoute({
  method: 'patch',
  path: '/api/v1/acudientes/{id}',
  summary: 'Actualiza un acudiente (admin y operador)',
  request: {
    params: idParams,
    body: { content: { 'application/json': { schema: acudienteActualizacionSchema } }, required: true },
  },
  responses: {
    200: { description: 'Acudiente actualizado', content: { 'application/json': { schema: acudienteSchema } } },
    ...respuestasError(400, 401, 404, 409),
  },
});

const rutaEliminar = createRoute({
  method: 'delete',
  path: '/api/v1/acudientes/{id}',
  summary: 'Elimina un acudiente (borrado físico; admin y operador)',
  request: { params: idParams },
  responses: {
    204: { description: 'Acudiente eliminado' },
    ...respuestasError(400, 401, 404),
  },
});

export const rutasAcudientes = new OpenAPIHono<EnvAplicacion>();

rutasAcudientes.use('/api/v1/acudientes/*', requerirAuth);
rutasAcudientes.use('/api/v1/afiliados/*', requerirAuth);

rutasAcudientes.openapi(rutaListar, async (c) => {
  const filas = await servicio.listarAcudientes(contextoDe(c), c.req.valid('param').id);
  return c.json(serializar(z.array(acudienteSchema), filas), 200);
});

rutasAcudientes.openapi(rutaCrear, async (c) => {
  const creado = await servicio.crearAcudiente(
    contextoDe(c),
    c.req.valid('param').id,
    aCamel(c.req.valid('json')),
  );
  return c.json(serializar(acudienteSchema, creado), 201);
});

rutasAcudientes.openapi(rutaActualizar, async (c) => {
  const actualizado = await servicio.actualizarAcudiente(
    contextoDe(c),
    c.req.valid('param').id,
    aCamel(c.req.valid('json')),
  );
  return c.json(serializar(acudienteSchema, actualizado), 200);
});

rutasAcudientes.openapi(rutaEliminar, async (c) => {
  await servicio.eliminarAcudiente(contextoDe(c), c.req.valid('param').id);
  return c.body(null, 204);
});
