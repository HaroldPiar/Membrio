/**
 * App Hono de Membrio, exportada INDEPENDIENTE de Astro para poder probarla
 * sin arrancar Astro (specplan: restricción). Astro solo la aloja en
 * src/pages/api/[...route].ts llamando a app.fetch(request).
 *
 * Errores: todo error no atrapado termina en manejarErrores con la forma
 * uniforme { error: { code, message, details } } (spec §9). Las rutas
 * OpenAPI usan defaultHook para que sus errores de validación sean MISMA
 * forma uniforme (400 VALIDACION).
 *
 * Documentación: /api/v1/docs (Swagger UI) y /api/v1/openapi.json (OpenAPI
 * 3.1), solo fuera de producción (spec §9 / specplan Swagger).
 */
import { OpenAPIHono } from '@hono/zod-openapi';
import { swaggerUI } from '@hono/swagger-ui';

import { entorno } from './config/env';
import { manejarErrores } from './errors';
import type { EnvAplicacion } from './middleware/auth';
import { rutasAcudientes } from './routes/acudientes';
import { rutasAfiliados } from './routes/afiliados';
import { rutasArchivos } from './routes/archivos';
import { rutasAuth } from './routes/auth';
import { rutasCategorias } from './routes/categorias';
import { rutasDashboard } from './routes/dashboard';
import { rutasEps } from './routes/eps';
import { rutaMe } from './routes/me';
import { rutasPagos } from './routes/pagos';
import { rutasPlanes } from './routes/planes';
import { rutasUsuarios } from './routes/usuarios';

const app = new OpenAPIHono<EnvAplicacion>({
  defaultHook: (result, c) => {
    if (!result.success) {
      return c.json(
        { error: { code: 'VALIDACION', message: 'Datos inválidos', details: result.error.issues } },
        400,
      );
    }
  },
});

app.onError(manejarErrores);

// 404 también con la forma uniforme (una ruta inexistente es un error de la API).
app.notFound((c) =>
  c.json(
    { error: { code: 'RUTA_NO_ENCONTRADA', message: `Ruta no encontrada: ${c.req.method} ${c.req.path}`, details: [] } },
    404,
  ),
);

app.route('/', rutasAuth);
app.route('/', rutaMe);
app.route('/', rutasUsuarios);
app.route('/', rutasPlanes);
app.route('/', rutasCategorias);
app.route('/', rutasEps);
app.route('/', rutasAfiliados);
app.route('/', rutasAcudientes);
app.route('/', rutasPagos);
app.route('/', rutasArchivos);
app.route('/', rutasDashboard);

if (entorno.NODE_ENV !== 'production') {
  app.openAPIRegistry.registerComponent('securitySchemes', 'Bearer', {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
    description: 'Token de sesión (dev-login en desarrollo; Supabase Auth en producción)',
  });
  app.doc31('/api/v1/openapi.json', {
    openapi: '3.1.0',
    info: {
      title: 'API de Membrio',
      version: '0.1.0',
      description:
        'API multi-tenant de afiliados y cobros (spec §9). Errores con forma uniforme ' +
        '{ error: { code, message, details } }; montos como cadenas decimales; ' +
        'organizacion_id siempre proviene de la sesión, nunca del request.',
    },
    security: [{ Bearer: [] }],
  });
  app.get('/api/v1/docs', swaggerUI({ url: '/api/v1/openapi.json' }));
}

export { app };
