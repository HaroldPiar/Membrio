/**
 * Astro aloja el cliente (islas React) y la API Hono en el mismo origen
 * (specplan Fase 3 + Spec del cliente §5). `output: 'server'` porque el
 * catch-all de /api/* debe ejecutarse en cada request y porque las páginas
 * protegidas se resuelven en servidor (middleware de sesión, sin parpadeo).
 * El adaptador node (standalone) permite además `astro build`.
 */
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

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
  integrations: [react()],
  server: { port: 4321 },
  vite: {
    plugins: [tailwindcss()],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  },
});
