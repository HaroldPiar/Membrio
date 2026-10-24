/**
 * /api/v1/afiliados (spec §9):
 *   GET    filtros q/activo/categoria/plan/estado_pago + paginación limit/cursor
 *   POST   alta (admin y operador)
 *   GET    detalle por id
 *   PATCH  edición (admin y operador)
 *   POST   /{id}/retiro — SOLO admin (matriz §4: "Borrar afiliados" = retiro
 *          lógico, §8.5; nunca borrado físico)
 */
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';

import type { EnvAplicacion } from '../middleware/auth';
import { contextoDe, requerirAuth, requerirRol } from '../middleware/auth';
import * as servicio from '../services/afiliados';
import { aCamel, serializar } from '../../shared/casing';
import {
  afiliadoActualizacionSchema,
  afiliadoCreacionSchema,
  afiliadoFiltrosSchema,
  afiliadoSchema,
  retiroSchema,
} from '../../shared/afiliados';
import { respuestasError } from '../../shared/errores';
import {
  decodificarCursor,
  limiteConDetras,
  paginar,
  respuestaPaginadaSchema,
} from '../../shared/paginacion';

const listado = respuestaPaginadaSchema(afiliadoSchema);
const idParams = z.object({ id: z.uuid() });

const rutaListar = createRoute({
  method: 'get',
  path: '/api/v1/afiliados',
  summary: 'Lista afiliados con filtros y paginación',
  description:
    'estado_pago filtra sobre el estado CALCULADO (solo afiliados activos); el resto de filtros se aplican en SQL.',
  request: { query: afiliadoFiltrosSchema },
  responses: {
    200: { description: 'Página de afiliados', content: { 'application/json': { schema: listado } } },
    ...respuestasError(400, 401),
  },
});

const rutaCrear = createRoute({
  method: 'post',
  path: '/api/v1/afiliados',
  summary: 'Crea un afiliado (admin y operador)',
  request: {
    body: { content: { 'application/json': { schema: afiliadoCreacionSchema } }, required: true },
  },
  responses: {
    201: { description: 'Afiliado creado', content: { 'application/json': { schema: afiliadoSchema } } },
    ...respuestasError(400, 401, 422),
  },
});

const rutaObtener = createRoute({
  method: 'get',
  path: '/api/v1/afiliados/{id}',
  summary: 'Obtiene un afiliado por id (con estado de pago calculado)',
  request: { params: idParams },
  responses: {
    200: { description: 'Afiliado', content: { 'application/json': { schema: afiliadoSchema } } },
    ...respuestasError(400, 401, 404),
  },
});

const rutaActualizar = createRoute({
  method: 'patch',
  path: '/api/v1/afiliados/{id}',
  summary: 'Actualiza un afiliado (admin y operador)',
  request: {
    params: idParams,
    body: { content: { 'application/json': { schema: afiliadoActualizacionSchema } }, required: true },
  },
  responses: {
    200: { description: 'Afiliado actualizado', content: { 'application/json': { schema: afiliadoSchema } } },
    ...respuestasError(400, 401, 404, 409, 422),
  },
});

const rutaRetiro = createRoute({
  method: 'post',
  path: '/api/v1/afiliados/{id}/retiro',
  summary: 'Retira un afiliado — lógico, solo admin (§8.5)',
  middleware: [requerirRol('admin')] as const,
  request: {
    params: idParams,
    body: { content: { 'application/json': { schema: retiroSchema } }, required: false },
  },
  responses: {
    200: {
      description: 'Afiliado retirado (activo=false con fecha y motivo)',
      content: { 'application/json': { schema: afiliadoSchema } },
    },
    ...respuestasError(400, 401, 403, 404, 409),
  },
});

export const rutasAfiliados = new OpenAPIHono<EnvAplicacion>();

rutasAfiliados.use('/api/v1/afiliados/*', requerirAuth);

rutasAfiliados.openapi(rutaListar, async (c) => {
  const q = c.req.valid('query');
  const filas = await servicio.listarAfiliados(contextoDe(c), {
    q: q.q,
    activo: q.activo,
    categoria: q.categoria,
    plan: q.plan,
    estado_pago: q.estado_pago,
    cursor: decodificarCursor(q.cursor),
    limit: limiteConDetras(q.limit),
  });
  return c.json(serializar(listado, paginar(filas, q.limit, (f) => f.nombre)), 200);
});

rutasAfiliados.openapi(rutaCrear, async (c) => {
  const creado = await servicio.crearAfiliado(contextoDe(c), aCamel(c.req.valid('json')));
  return c.json(serializar(afiliadoSchema, creado), 201);
});

rutasAfiliados.openapi(rutaObtener, async (c) => {
  const afiliado = await servicio.obtenerAfiliado(contextoDe(c), c.req.valid('param').id);
  return c.json(serializar(afiliadoSchema, afiliado), 200);
});

rutasAfiliados.openapi(rutaActualizar, async (c) => {
  const actualizado = await servicio.actualizarAfiliado(
    contextoDe(c),
    c.req.valid('param').id,
    aCamel(c.req.valid('json')),
  );
  return c.json(serializar(afiliadoSchema, actualizado), 200);
});

rutasAfiliados.openapi(rutaRetiro, async (c) => {
  const body = c.req.valid('json');
  const retirado = await servicio.retirarAfiliado(contextoDe(c), c.req.valid('param').id, {
    fecha_retiro: body.fecha_retiro,
    motivo_retiro: body.motivo_retiro,
  });
  return c.json(serializar(afiliadoSchema, retirado), 200);
});
