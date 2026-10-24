/**
 * Montaje de la API Hono dentro de Astro (specplan: Hono montado en
 * src/pages/api/[...route].ts). Astro delega la petición completa en
 * app.fetch; el router interno de Hono resuelve /api/v1/* y devuelve el
 * 404 envelope uniforme para el resto. La app se importa desde
 * src/server/app.ts, independiente de Astro, para probarla con `pnpm dev:api`.
 */
import type { APIRoute } from 'astro';

import { app } from '../../server/app';

export const prerender = false;

export const ALL: APIRoute = ({ request }) => app.fetch(request);
