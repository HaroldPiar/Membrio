/**
 * Integración: sesión por cookie + defensa CSRF + búsqueda `q` (spec del
 * cliente §6, Fase 1 Paso 0). Cubre lo que la lectura de código confirma:
 *
 *  - dev-login fija `membrio_session` (HttpOnly, SameSite=Lax, Path=/,
 *    Max-Age = 12 h del JWT, Secure solo en producción → aquí NO aparece).
 *  - Esa cookie autentica igual que el Bearer (GET /me).
 *  - logout borra la cookie.
 *  - Cookie + método mutante con origen ajeno → 403 CSRF_RECHAZADO;
 *    Bearer no se ve afectado; GET con cookie tampoco.
 *  - GET /afiliados?q= busca por nombre Y por número de documento (ilike).
 *
 * Requiere la base local levantada y con seed. Se corre con
 * `pnpm test:integracion`.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { app } from '../../src/server/app';
import { sqlClient } from '../../src/server/db/client';

const CORREO_ADMIN = 'admin@truchas.test';
const ORIGEN_MALO = 'https://evil.example.com';

let token = '';
let cookie = '';

function solicitar(ruta: string, init: RequestInit = {}): Promise<Response> {
  return Promise.resolve(app.request(ruta, init));
}

function login(): Promise<Response> {
  return solicitar('/api/v1/auth/dev-login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ correo: CORREO_ADMIN }),
  });
}

function extraerCookie(setCookie: string | null): string {
  expect(setCookie).toContain('membrio_session=');
  return (setCookie ?? '').split(';')[0] ?? '';
}

beforeAll(async () => {
  const r = await login();
  expect(r.status).toBe(200);
  cookie = extraerCookie(r.headers.get('set-cookie'));
  token = ((await r.json()) as { token: string }).token;
});

afterAll(async () => {
  await sqlClient.end({ timeout: 5 });
});

describe('dev-login fija la cookie de sesión', () => {
  it('atributos: HttpOnly, SameSite=Lax, Path=/, Max-Age ≈ 12 h y sin Secure en dev', async () => {
    const r = await login();
    expect(r.status).toBe(200);
    const sc = r.headers.get('set-cookie') ?? '';
    expect(sc).toContain('membrio_session=');
    expect(sc).toMatch(/httponly/i);
    expect(sc).toMatch(/samesite=lax/i);
    expect(sc).toMatch(/path=\//i);
    expect(sc).not.toMatch(/secure/i); // NODE_ENV no es production → Secure no va
    const maxAge = Number(/max-age=(\d+)/i.exec(sc)?.[1] ?? '0');
    expect(maxAge).toBeGreaterThan(43_000);
    expect(maxAge).toBeLessThanOrEqual(43_200);
  });

  it('la cookie autentica GET /me igual que el Bearer', async () => {
    const porCookie = await solicitar('/api/v1/me', { headers: { cookie } });
    expect(porCookie.status).toBe(200);
    const me = (await porCookie.json()) as { correo: string; rol: string };
    expect(me.correo).toBe(CORREO_ADMIN);
    expect(me.rol).toBe('admin');
  });

  it('el token del body sigue existiendo para Swagger y los curl (Bearer)', async () => {
    const r = await solicitar('/api/v1/me', { headers: { authorization: `Bearer ${token}` } });
    expect(r.status).toBe(200);
  });
});

describe('logout', () => {
  it('con cookie y origen propio borra la cookie (204)', async () => {
    const r = await solicitar('/api/v1/auth/logout', {
      method: 'POST',
      headers: { cookie, origin: 'http://localhost' },
    });
    expect(r.status).toBe(204);
    const sc = r.headers.get('set-cookie') ?? '';
    expect(sc).toContain('membrio_session=;');
    expect(sc).toMatch(/max-age=0/i);
  });

  it('con Bearer el origen ajeno no lo afecta (no es vulnerable a CSRF)', async () => {
    const r = await solicitar('/api/v1/auth/logout', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, origin: ORIGEN_MALO },
    });
    expect(r.status).toBe(204);
  });
});

describe('defensa CSRF con cookie (solo métodos mutantes)', () => {
  it('Origin ajeno → 403 CSRF_RECHAZADO', async () => {
    const r = await solicitar('/api/v1/auth/logout', {
      method: 'POST',
      headers: { cookie, origin: ORIGEN_MALO },
    });
    expect(r.status).toBe(403);
    const cuerpo = (await r.json()) as { error: { code: string } };
    expect(cuerpo.error.code).toBe('CSRF_RECHAZADO');
  });

  it('Sec-Fetch-Site: cross-site → 403 aunque no venga Origin', async () => {
    const r = await solicitar('/api/v1/auth/logout', {
      method: 'POST',
      headers: { cookie, 'sec-fetch-site': 'cross-site' },
    });
    expect(r.status).toBe(403);
    const cuerpo = (await r.json()) as { error: { code: string } };
    expect(cuerpo.error.code).toBe('CSRF_RECHAZADO');
  });

  it('Sec-Fetch-Site: same-origin → pasa', async () => {
    const r = await solicitar('/api/v1/auth/logout', {
      method: 'POST',
      headers: { cookie, 'sec-fetch-site': 'same-origin' },
    });
    expect(r.status).toBe(204);
  });

  it('GET con cookie no exige origen (solo mutantes)', async () => {
    const r = await solicitar('/api/v1/me', { headers: { cookie, origin: ORIGEN_MALO } });
    expect(r.status).toBe(200);
  });
});

describe('GET /afiliados?q= busca por nombre y por documento', () => {
  it('encuentra por número de documento y por nombre (case-insensitive)', async () => {
    const lista = await solicitar('/api/v1/afiliados?limit=100', {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(lista.status).toBe(200);
    const { datos } = (await lista.json()) as {
      datos: { id: string; nombre: string; numero_documento: string }[];
    };
    expect(datos.length).toBeGreaterThan(0);
    const muestra = datos[0];
    expect(muestra).toBeDefined();
    if (!muestra) return;

    const porDocumento = await solicitar(
      `/api/v1/afiliados?q=${encodeURIComponent(muestra.numero_documento.slice(-6))}`,
      { headers: { authorization: `Bearer ${token}` } },
    );
    const rDoc = (await porDocumento.json()) as { datos: { id: string }[] };
    expect(rDoc.datos.some((d) => d.id === muestra.id)).toBe(true);

    const porNombre = await solicitar(
      `/api/v1/afiliados?q=${encodeURIComponent(muestra.nombre.toLowerCase())}`,
      { headers: { authorization: `Bearer ${token}` } },
    );
    expect(porNombre.status).toBe(200);
    const rNom = (await porNombre.json()) as { datos: { id: string }[] };
    expect(rNom.datos.some((d) => d.id === muestra.id)).toBe(true);
  });

  it('sin coincidencias devuelve lista vacía', async () => {
    const r = await solicitar('/api/v1/afiliados?q=zzzz-no-existe-9999', {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(r.status).toBe(200);
    const cuerpo = (await r.json()) as { datos: unknown[] };
    expect(cuerpo.datos).toHaveLength(0);
  });
});
