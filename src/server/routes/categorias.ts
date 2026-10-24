/**
 * GET/POST /api/v1/categorias, GET/PATCH/DELETE /api/v1/categorias/:id (spec §9).
 * Escritura: solo admin (matriz §4). Capa routes: Zod + llamada al service.
 */
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';

import type { EnvAplicacion } from '../middleware/auth';
import { contextoDe, requerirAuth, requerirRol } from '../middleware/auth';
import * as servicio from '../services/catalogos';
import { serializar } from '../../shared/casing';
import { respuestasError } from '../../shared/errores';
import { categoriaActualizacionSchema, categoriaCreacionSchema, categoriaSchema } from '../../shared/catalogos';
import {
  decodificarCursor,
  limiteConDetras,
  paginar,
  paginacionQuerySchema,
  respuestaPaginadaSchema,
} from '../../shared/paginacion';

const queryListar = paginacionQuerySchema.extend({
  activa: z.coerce.boolean().optional().openapi({
    description: 'true/false; sin este parámetro se devuelven ambas estados',
  }),
});

const listado = respuestaPaginadaSchema(categoriaSchema);

const rutaListar = createRoute({
  method: 'get',
  path: '/api/v1/categorias',
  summary: 'Lista las categorías (cursos) de la organización',
  request: { query: queryListar },
  responses: {
    200: { description: 'Página de categorías', content: { 'application/json': { schema: listado } } },
    ...respuestasError(400, 401),
  },
});

const rutaCrear = createRoute({
  method: 'post',
  path: '/api/v1/categorias',
  summary: 'Crea una categoría (solo admin)',
  middleware: [requerirRol('admin')] as const,
  request: {
    body: { content: { 'application/json': { schema: categoriaCreacionSchema } }, required: true },
  },
  responses: {
    201: { description: 'Categoría creada', content: { 'application/json': { schema: categoriaSchema } } },
    ...respuestasError(400, 401, 403, 409),
  },
});

const idParams = z.object({ id: z.uuid() });

const rutaObtener = createRoute({
  method: 'get',
  path: '/api/v1/categorias/{id}',
  summary: 'Obtiene una categoría por id',
  request: { params: idParams },
  responses: {
    200: { description: 'Categoría', content: { 'application/json': { schema: categoriaSchema } } },
    ...respuestasError(400, 401, 404),
  },
});

const rutaActualizar = createRoute({
  method: 'patch',
  path: '/api/v1/categorias/{id}',
  summary: 'Actualiza una categoría (solo admin)',
  middleware: [requerirRol('admin')] as const,
  request: {
    params: idParams,
    body: { content: { 'application/json': { schema: categoriaActualizacionSchema } }, required: true },
  },
  responses: {
    200: { description: 'Categoría actualizada', content: { 'application/json': { schema: categoriaSchema } } },
    ...respuestasError(400, 401, 403, 404, 409),
  },
});

const rutaDesactivar = createRoute({
  method: 'delete',
  path: '/api/v1/categorias/{id}',
  summary: 'Desactiva una categoría (baja lógica, solo admin)',
  middleware: [requerirRol('admin')] as const,
  request: { params: idParams },
  responses: {
    200: { description: 'Categoría desactivada', content: { 'application/json': { schema: categoriaSchema } } },
    ...respuestasError(400, 401, 403, 404),
  },
});

export const rutasCategorias = new OpenAPIHono<EnvAplicacion>();

rutasCategorias.use('/api/v1/categorias/*', requerirAuth);

rutasCategorias.openapi(rutaListar, async (c) => {
  const q = c.req.valid('query');
  const filas = await servicio.listarCategorias(contextoDe(c), {
    cursor: decodificarCursor(q.cursor),
    limit: limiteConDetras(q.limit),
    activa: q.activa,
  });
  return c.json(serializar(listado, paginar(filas, q.limit, (f) => f.nombre)), 200);
});

rutasCategorias.openapi(rutaCrear, async (c) => {
  const creada = await servicio.crearCategoria(contextoDe(c), c.req.valid('json'));
  return c.json(serializar(categoriaSchema, creada), 201);
});

rutasCategorias.openapi(rutaObtener, async (c) => {
  const categoria = await servicio.obtenerCategoria(contextoDe(c), c.req.valid('param').id);
  return c.json(serializar(categoriaSchema, categoria), 200);
});

rutasCategorias.openapi(rutaActualizar, async (c) => {
  const categoria = await servicio.actualizarCategoria(
    contextoDe(c),
    c.req.valid('param').id,
    c.req.valid('json'),
  );
  return c.json(serializar(categoriaSchema, categoria), 200);
});

rutasCategorias.openapi(rutaDesactivar, async (c) => {
  const categoria = await servicio.desactivarCategoria(contextoDe(c), c.req.valid('param').id);
  return c.json(serializar(categoriaSchema, categoria), 200);
});
