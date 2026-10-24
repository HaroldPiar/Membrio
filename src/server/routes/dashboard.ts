/**
 * /api/v1/dashboard (spec §9 y §8.4): resumen, morosidad y recaudo.
 * Ambos roles (matriz §4: "Ver dashboard: admin y operador").
 * Los montos salen como cadenas decimales; la cartera se valora en centavos.
 */
import { OpenAPIHono, createRoute } from '@hono/zod-openapi';

import type { EnvAplicacion } from '../middleware/auth';
import { contextoDe, requerirAuth } from '../middleware/auth';
import { morosidadDashboard, recaudoDashboard, resumenDashboard } from '../services/dashboard';
import { serializar } from '../../shared/casing';
import { morosidadSchema, recaudoSchema, resumenDashboardSchema } from '../../shared/dashboard';
import { respuestasError } from '../../shared/errores';

const rutaResumen = createRoute({
  method: 'get',
  path: '/api/v1/dashboard/resumen',
  summary: 'Conteos de afiliados por estado, pagos pendientes y recaudo del mes',
  responses: {
    200: { description: 'Resumen', content: { 'application/json': { schema: resumenDashboardSchema } } },
    ...respuestasError(400, 401),
  },
});

const rutaMorosidad = createRoute({
  method: 'get',
  path: '/api/v1/dashboard/morosidad',
  summary: 'Cartera: afiliados en mora con meses adeudados y valor estimado',
  responses: {
    200: { description: 'Cartera pendiente', content: { 'application/json': { schema: morosidadSchema } } },
    ...respuestasError(400, 401),
  },
});

const rutaRecaudo = createRoute({
  method: 'get',
  path: '/api/v1/dashboard/recaudo',
  summary: 'Recaudo verificado por mes (últimos 12 meses)',
  responses: {
    200: { description: 'Serie mensual de recaudo', content: { 'application/json': { schema: recaudoSchema } } },
    ...respuestasError(400, 401),
  },
});

export const rutasDashboard = new OpenAPIHono<EnvAplicacion>();

rutasDashboard.use('/api/v1/dashboard/*', requerirAuth);

rutasDashboard.openapi(rutaResumen, async (c) => {
  return c.json(serializar(resumenDashboardSchema, await resumenDashboard(contextoDe(c))), 200);
});

rutasDashboard.openapi(rutaMorosidad, async (c) => {
  return c.json(serializar(morosidadSchema, await morosidadDashboard(contextoDe(c))), 200);
});

rutasDashboard.openapi(rutaRecaudo, async (c) => {
  return c.json(serializar(recaudoSchema, await recaudoDashboard(contextoDe(c))), 200);
});
