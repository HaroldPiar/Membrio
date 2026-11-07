/**
 * Task login producción — montaje de las rutas de login por modo de entorno.
 *
 * El contrato OpenAPI registra SIEMPRE `/api/v1/auth/dev-login` y `/api/v1/auth/login`
 * (vía `openAPIRegistry.registerPath`); en runtime solo se monta la que corresponde
 * al `AUTH_MODE` activo:
 *
 *  - AUTH_MODE=password → /auth/dev-login NO montada → 404 RUTA_NO_ENCONTRADA.
 *  - AUTH_MODE=dev     → /auth/login   NO montada → 404 RUTA_NO_ENCONTRADA.
 *
 * Además: el documento OpenAPI debe contener ambas rutas en ambos modos.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { app as appServidor } from '../../src/server/app';

type AppServidor = typeof appServidor;

type Modo = 'dev' | 'password';

async function cargarApp(mode: Modo): Promise<AppServidor> {
  vi.resetModules();
  process.env.NODE_ENV = 'development';
  process.env.AUTH_MODE = mode;
  process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://postgres:0000@127.0.0.1:5433/membrio_prueba';
  process.env.DEV_JWT_SECRET = process.env.DEV_JWT_SECRET ?? 'x'.repeat(48);
  process.env.SESSION_JWT_SECRET = process.env.SESSION_JWT_SECRET ?? 'x'.repeat(48);
  const modulo = (await import('../../src/server/app')) as { app: AppServidor };
  const app = modulo.app;
  if (!app) throw new Error('No se pudo cargar la app del servidor');
  return app;
}

describe('Montaje de rutas de login por modo (task login producción)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('con AUTH_MODE=password, POST /api/v1/auth/dev-login responde 404 RUTA_NO_ENCONTRADA', async () => {
    const app = await cargarApp('password');
    const respuesta = await app.request('/api/v1/auth/dev-login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ correo: 'admin@truchas.test' }),
    });
    expect(respuesta.status).toBe(404);
    const cuerpo = (await respuesta.json()) as { error?: { code?: string } };
    expect(cuerpo.error?.code).toBe('RUTA_NO_ENCONTRADA');
  });

  it('con AUTH_MODE=dev, POST /api/v1/auth/login responde 404 RUTA_NO_ENCONTRADA', async () => {
    const app = await cargarApp('dev');
    const respuesta = await app.request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ correo: 'admin@truchas.test', password: 'contrasena-valida-123' }),
    });
    expect(respuesta.status).toBe(404);
    const cuerpo = (await respuesta.json()) as { error?: { code?: string } };
    expect(cuerpo.error?.code).toBe('RUTA_NO_ENCONTRADA');
  });

  it('el contrato OpenAPI registra ambas rutas de login en ambos modos', async () => {
    for (const mode of ['dev', 'password'] as const) {
      const app = await cargarApp(mode);
      const respuesta = await app.request('/api/v1/openapi.json');
      expect(respuesta.status).toBe(200);
      const documento = (await respuesta.json()) as { paths?: Record<string, unknown> };
      expect(documento.paths?.['/api/v1/auth/dev-login']).toBeDefined();
      expect(documento.paths?.['/api/v1/auth/login']).toBeDefined();
    }
  });
});
