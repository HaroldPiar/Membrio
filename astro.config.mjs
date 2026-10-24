/**
 * Astro existe SOLO para alojar la API Hono (specplan Fase 3: sin frontend real).
 * `output: 'server'` porque el catch-all de /api/* debe ejecutarse en cada
 * request; el adaptador node (standalone) permite además `astro build`.
 */
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

// .env se carga ANTES de que src/server/config/env.ts valide las variables al
// importar la app: Astro/Vite solo publica en import.meta.env las claves con
// prefijo VITE_, así que DATABASE_URL y cía. no llegan solas a process.env.
try {
  process.loadEnvFile('.env');
} catch {
  // sin .env: env.ts fallará al importar la app con un mensaje claro.
}

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  server: { port: 4321 },
});
