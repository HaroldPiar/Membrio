/**
 * API standalone con @hono/node-server: levanta la app Hono SIN Astro
 * (la restricción del specplan pide poder probarla sin arrancar Astro).
 *
 *   pnpm dev:api                        → http://localhost:3000
 *   PORT=4000 pnpm dev:api              → puerto custom
 *
 * Ejemplo (con el seed aplicado):
 *   curl -s -X POST localhost:3000/api/v1/auth/dev-login \
 *     -H 'content-type: application/json' \
 *     -d '{"correo":"admin@truchas.test"}'
 *   curl -s localhost:3000/api/v1/me -H "authorization: Bearer $TOKEN"
 */
import { serve } from '@hono/node-server';

import { app } from '../src/server/app';

const puerto = Number(process.env.PORT ?? 3000);

serve({ fetch: app.fetch, port: puerto }, (info) => {
  console.log(`Membrio API (standalone, sin Astro) en http://localhost:${info.port}`);
});
