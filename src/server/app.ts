/**
 * App Hono de Membrio, exportada INDEPENDIENTE de Astro para poder probarla
 * sin arrancar Astro (specplan: restricción). Astro solo la alojará en
 * src/pages/api/[...route].ts llamando a app.fetch(request) (Fase 3).
 *
 * Errores: todo error no atrapado termina en manejarErrores con la forma
 * uniforme { error: { code, message, details } } (spec §9).
 */
import { Hono } from 'hono';

import { manejarErrores } from './errors';
import type { EnvAplicacion } from './middleware/auth';
import { rutasAuth } from './routes/auth';
import { rutaMe } from './routes/me';

export const app = new Hono<EnvAplicacion>();

app.onError(manejarErrores);

// 404 también con la forma uniforme (una ruta inexistente es un error de la API).
app.notFound((c) =>
  c.json(
    { error: { code: 'RUTA_NO_ENCONTRADA', message: `Ruta no encontrada: ${c.req.method} ${c.req.path}`, details: [] } },
    404,
  ),
);

app.route('/api/v1/auth', rutasAuth);
app.route('/api/v1/me', rutaMe);
