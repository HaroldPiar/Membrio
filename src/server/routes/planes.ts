/**
 * GET/POST /api/v1/planes, GET/PATCH/DELETE /api/v1/planes/:id (spec §9).
 * Escritura: solo admin (matriz §4).
 */
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';

import type { EnvAplicacion } from '../middleware/auth';
import { contextoDe, requerirAuth, requerirRol } from '../middleware/auth';
import * as servicio from '../services/catalogos';
import { aCamel, serializar } from '../../shared/casing';
import { planActualizacionSchema, planCreacionSchema, planSchema } from '../../shared/catalogos';
import { respuestasError } from '../../shared/errores';
import {
  decodificarCursor,
  limiteConDetras,
  paginar,
  paginacionQuerySchema,
  respuestaPaginadaSchema,
} from '../../shared/paginacion';

const queryListar = paginacionQuerySchema.extend({
  activo: z.coerce.boolean().optional().openapi({
    description: 'true/false; sin este parámetro se devuelven ambos estados',
  }),
});

const listado = respuestaPaginadaSchema(planSchema);
const idParams = z.object({ id: z.uuid() });

const rutaListar = createRoute({
  method: 'get',
  path: '/api/v1/planes',
  summary: 'Lista los planes de la organización',
  request: { query: queryListar },
  responses: {
    200: { description: 'Página de planes', content: { 'application/json': { schema: listado } } },
    ...respuestasError(400, 401),
  },
});

const rutaCrear = createRoute({
  method: 'post',
  path: '/api/v1/planes',
  summary: 'Crea un plan (solo admin)',
  middleware: [requerirRol('admin')] as const,
  request: {
    body: { content: { 'application/json': { schema: planCreacionSchema } }, required: true },
  },
  responses: {
    201: { description: 'Plan creado', content: { 'application/json': { schema: planSchema } } },
    ...respuestasError(400, 401, 403, 409),
  },
});

const rutaObtener = createRoute({
  method: 'get',
  path: '/api/v1/planes/{id}',
  summary: 'Obtiene un plan por id',
  request: { params: idParams },
  responses: {
    200: { description: 'Plan', content: { 'application/json': { schema: planSchema } } },
    ...respuestasError(400, 401, 404),
  },
});

const rutaActualizar = createRoute({
  method: 'patch',
  path: '/api/v1/planes/{id}',
  summary: 'Actualiza un plan (solo admin)',
  middleware: [requerirRol('admin')] as const,
  request: {
    params: idParams,
    body: { content: { 'application/json': { schema: planActualizacionSchema } }, required: true },
  },
  responses: {
    200: { description: 'Plan actualizado', content: { 'application/json': { schema: planSchema } } },
    ...respuestasError(400, 401, 403, 404, 409),
  },
});

const rutaDesactivar = createRoute({
  method: 'delete',
  path: '/api/v1/planes/{id}',
  summary: 'Desactiva un plan (baja lógica, solo admin)',
  middleware: [requerirRol('admin')] as const,
  request: { params: idParams },
  responses: {
    200: { description: 'Plan desactivado', content: { 'application/json': { schema: planSchema } } },
    ...respuestasError(400, 401, 403, 404),
  },
});

export const rutasPlanes = new OpenAPIHono<EnvAplicacion>();

rutasPlanes.use('/api/v1/planes/*', requerirAuth);

rutasPlanes.openapi(rutaListar, async (c) => {
  const q = c.req.valid('query');
  const filas = await servicio.listarPlanes(contextoDe(c), {
    cursor: decodificarCursor(q.cursor),
    limit: limiteConDetras(q.limit),
    activo: q.activo,
  });
  return c.json(serializar(listado, paginar(filas, q.limit, (f) => f.nombre)), 200);
});

rutasPlanes.openapi(rutaCrear, async (c) => {
  const creado = await servicio.crearPlan(contextoDe(c), aCamel(c.req.valid('json')));
  return c.json(serializar(planSchema, creado), 201);
});

rutasPlanes.openapi(rutaObtener, async (c) => {
  const plan = await servicio.obtenerPlan(contextoDe(c), c.req.valid('param').id);
  return c.json(serializar(planSchema, plan), 200);
});

rutasPlanes.openapi(rutaActualizar, async (c) => {
  const plan = await servicio.actualizarPlan(
    contextoDe(c),
    c.req.valid('param').id,
    aCamel(c.req.valid('json')),
  );
  return c.json(serializar(planSchema, plan), 200);
});

rutasPlanes.openapi(rutaDesactivar, async (c) => {
  const plan = await servicio.desactivarPlan(contextoDe(c), c.req.valid('param').id);
  return c.json(serializar(planSchema, plan), 200);
});
