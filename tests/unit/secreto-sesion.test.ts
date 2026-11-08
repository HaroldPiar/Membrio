/**
 * Unidad: selección pura del secreto del JWT para el middleware de Astro.
 *
 * Cada AUTH_MODE usa su secreto (dev → DEV, password → SESSION, supabase →
 * SUPABASE); un modo desconocido cae en DEV (mismo comportamiento histórico
 * del middleware). Es UX de navegación: la API revalida todo.
 */
import { describe, expect, it } from 'vitest';

import { seleccionarSecretoSesion } from '../../src/lib/secreto-sesion';

const secretos = {
  devJwtSecret: 'dev-secreto',
  sessionJwtSecret: 'session-secreto',
  supabaseJwtSecret: 'supabase-secreto',
};

describe('seleccionarSecretoSesion', () => {
  it('password usa SESSION_JWT_SECRET', () => {
    expect(seleccionarSecretoSesion({ authMode: 'password', ...secretos })).toBe('session-secreto');
  });

  it('supabase usa SUPABASE_JWT_SECRET', () => {
    expect(seleccionarSecretoSesion({ authMode: 'supabase', ...secretos })).toBe('supabase-secreto');
  });

  it('dev y modos desconocidos usan DEV_JWT_SECRET', () => {
    expect(seleccionarSecretoSesion({ authMode: 'dev', ...secretos })).toBe('dev-secreto');
    expect(seleccionarSecretoSesion({ authMode: undefined, ...secretos })).toBe('dev-secreto');
    expect(seleccionarSecretoSesion({ authMode: 'otro', ...secretos })).toBe('dev-secreto');
  });

  it('sin el secreto del modo devuelve undefined (no hay sesión válida)', () => {
    expect(seleccionarSecretoSesion({ authMode: 'password' })).toBeUndefined();
    expect(seleccionarSecretoSesion({ authMode: 'supabase' })).toBeUndefined();
    expect(seleccionarSecretoSesion({})).toBeUndefined();
  });
});
