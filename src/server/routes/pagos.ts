/**
 * /api/v1/pagos (spec §9 y §8.1):
 *   GET    listado con filtros (estado, afiliado, rango de fechas)
 *   POST   pago con líneas — transacción, validación de pertenencia al
 *          tenant, suma y duplicados (los de forma ya vienen de Zod)
 *   GET    detalle con líneas
 *   PATCH  /{id}/estado — verificar o rechazar (admin y operador, §4);
 *          rechazar BORRA las líneas para liberar el mes (§8.1.5)
 */
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';

import type { EnvAplicacion } from '../middleware/auth';
import { contextoDe, requerirAuth } from '../middleware/auth';
import * as servicio from '../services/pagos';
import { aCamel, serializar } from '../../shared/casing';
import { respuestasError } from '../../shared/errores';
import {
  pagoActualizacionEstadoSchema,
  pagoCreacionSchema,
  pagoFiltrosSchema,
  pagoResumenSchema,
  pagoSchema,
} from '../../shared/pagos';
import {
  decodificarCursor,
  limiteConDetras,
  paginar,
  respuestaPaginadaSchema,
} from '../../shared/paginacion';

const listado = respuestaPaginadaSchema(pagoResumenSchema);
const idParams = z.object({ id: z.uuid() });

const rutaListar = createRoute({
  method: 'get',
  path: '/api/v1/pagos',
  summary: 'Lista pagos con filtros y paginación (sin líneas de detalle)',
  request: { query: pagoFiltrosSchema },
  responses: {
    200: { description: 'Página de pagos', content: { 'application/json': { schema: listado } } },
    ...respuestasError(400, 401),
  },
});

const rutaCrear = createRoute({
  method: 'post',
  path: '/api/v1/pagos',
  summary: 'Registra un pago con sus líneas (nace pendiente)',
  description:
    'monto_total debe igualar la suma de líneas; fecha_cobertura día 1; matrícula en enero; cada afiliado pertenece a la organización.',
  request: {
    body: { content: { 'application/json': { schema: pagoCreacionSchema } }, required: true },
  },
  responses: {
    201: { description: 'Pago creado', content: { 'application/json': { schema: pagoSchema } } },
    ...respuestasError(400, 401, 404, 409, 422),
  },
});

const rutaObtener = createRoute({
  method: 'get',
  path: '/api/v1/pagos/{id}',
  summary: 'Obtiene un pago con sus líneas',
  request: { params: idParams },
  responses: {
    200: { description: 'Pago', content: { 'application/json': { schema: pagoSchema } } },
    ...respuestasError(400, 401, 404),
  },
});

const rutaEstado = createRoute({
  method: 'patch',
  path: '/api/v1/pagos/{id}/estado',
  summary: 'Verifica o rechaza un pago (admin y operador)',
  description:
    'Al rechazar se liberan sus líneas de detalle para permitir un reintento del mismo mes (§8.1.5). Un pago rechazado no se re-verifica.',
  request: {
    params: idParams,
    body: { content: { 'application/json': { schema: pagoActualizacionEstadoSchema } }, required: true },
  },
  responses: {
    200: { description: 'Pago con su nuevo estado', content: { 'application/json': { schema: pagoSchema } } },
    ...respuestasError(400, 401, 404, 409),
  },
});

export const rutasPagos = new OpenAPIHono<EnvAplicacion>();

rutasPagos.use('/api/v1/pagos/*', requerirAuth);

rutasPagos.openapi(rutaListar, async (c) => {
  const q = c.req.valid('query');
  const filas = await servicio.listarPagos(contextoDe(c), {
    estado: q.estado,
    afiliado: q.afiliado,
    desde: q.desde,
    hasta: q.hasta,
    cursor: decodificarCursor(q.cursor),
    limit: limiteConDetras(q.limit),
  });
  return c.json(serializar(listado, paginar(filas, q.limit, (f) => f.createdAt.toISOString())), 200);
});

rutasPagos.openapi(rutaCrear, async (c) => {
  const creado = await servicio.crearPago(contextoDe(c), aCamel(c.req.valid('json')));
  return c.json(serializar(pagoSchema, creado), 201);
});

rutasPagos.openapi(rutaObtener, async (c) => {
  const pago = await servicio.obtenerPago(contextoDe(c), c.req.valid('param').id);
  return c.json(serializar(pagoSchema, pago), 200);
});

rutasPagos.openapi(rutaEstado, async (c) => {
  const pago = await servicio.cambiarEstadoPago(
    contextoDe(c),
    c.req.valid('param').id,
    c.req.valid('json').estado,
  );
  return c.json(serializar(pagoSchema, pago), 200);
});
