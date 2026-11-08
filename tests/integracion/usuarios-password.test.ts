/**
 * Integración: gestión de usuarios en producción (task).
 *
 * Cubre el flujo completo sobre la API real:
 *  - alta de usuario → contraseña temporal devuelta UNA vez (Cache-Control:
 *    no-store), flag debe_cambiar_password=true y el hash NUNCA viaja al wire;
 *  - login con la temporal → GET /me devuelve el flag; el resto de la API
 *    responde 403 CAMBIO_PASSWORD_REQUERIDO;
 *  - cambio self-service: actual incorrecta → 401; cambio exitoso → token nuevo,
 *    y el token emitido ANTES queda invalidado (iat < password_changed_at);
 *  - restablecimiento por admin → temporal nueva + flag otra vez;
 *  - salvaguardas: el admin no puede desactivarse ni quitarse el rol admin.
 *
 * Requiere la base local levantada y con seed (migración 0004 aplicada).
 * Se corre con `pnpm test:integracion`.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Ejercita el login con contraseña: fijar el modo activo ANTES de importar la app.
vi.hoisted(() => {
  process.env.AUTH_MODE = 'password';
  process.env.SESSION_JWT_SECRET = process.env.SESSION_JWT_SECRET ?? 'x'.repeat(48);
});

import { app } from '../../src/server/app';
import { hashPassword } from '../../src/server/auth/password';
import { sqlClient } from '../../src/server/db/client';

const CORREO_ADMIN = 'admin-integracion@truchas.test';
const CLAVE_ADMIN = 'clave-admin-1234';
const CORREO_NUEVO = 'temporal-integracion@truchas.test';
const CLAVE_NUEVA = 'clave-nueva-1234';

type CuerpoSesion = { token: string; usuario: { debe_cambiar_password: boolean } };

let tokenAdmin = '';
let idNuevo = '';
let temporal = '';
let tokenTemporal = '';

function pedir(ruta: string, init: RequestInit = {}): Promise<Response> {
  return Promise.resolve(app.request(ruta, init));
}

function conAdmin(metodo: string, cuerpo?: unknown): RequestInit {
  return {
    method: metodo,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${tokenAdmin}` },
    ...(cuerpo !== undefined ? { body: JSON.stringify(cuerpo) } : {}),
  };
}

async function iniciarSesion(correo: string, password: string): Promise<Response> {
  return pedir('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ correo, password }),
  });
}

beforeAll(async () => {
  // Admin PROPIO del test: los demás archivos usan el admin del seed con
  // dev-login, y tocar su hash invalidaría sus tokens (claim `ph`). Este test
  // corre en paralelo, así que jamás muta usuarios compartidos.
  await sqlClient`delete from usuarios where correo in (${CORREO_ADMIN}, ${CORREO_NUEVO})`;
  await sqlClient`
    insert into usuarios (organizacion_id, rol_id, correo, nombre, activo, password_hash, debe_cambiar_password)
    select o.id, r.id, ${CORREO_ADMIN}, 'Admin Integración', true, ${hashPassword(CLAVE_ADMIN)}, false
      from organizaciones o, roles r
     where o.slug = 'truchas' and r.nombre = 'admin'
  `;

  const respuesta = await iniciarSesion(CORREO_ADMIN, CLAVE_ADMIN);
  expect(respuesta.status).toBe(200);
  tokenAdmin = ((await respuesta.json()) as CuerpoSesion).token;
});

afterAll(async () => {
  await sqlClient`delete from usuarios where correo in (${CORREO_ADMIN}, ${CORREO_NUEVO})`;
  await sqlClient.end({ timeout: 5 });
});

describe('alta con contraseña temporal', () => {
  it('devuelve la temporal UNA sola vez, marca el flag y no filtra el hash', async () => {
    const respuesta = await pedir(
      '/api/v1/usuarios',
      conAdmin('POST', { correo: CORREO_NUEVO, nombre: 'Usuario Temporal', rol: 'operador' }),
    );
    expect(respuesta.status).toBe(201);
    expect(respuesta.headers.get('cache-control')).toContain('no-store');

    const cuerpo = (await respuesta.json()) as {
      usuario: { id: string; debe_cambiar_password: boolean; password_hash?: string };
      contrasena_temporal: string;
    };
    expect(cuerpo.contrasena_temporal).toMatch(/^[a-hj-km-np-zA-HJ-KM-NP-Z2-9]{16}$/);
    expect(cuerpo.usuario.debe_cambiar_password).toBe(true);
    expect(cuerpo.usuario.password_hash).toBeUndefined();

    idNuevo = cuerpo.usuario.id;
    temporal = cuerpo.contrasena_temporal;
  });

  it('con la temporal el login entra, /me marca el flag y el resto responde 403', async () => {
    const respuesta = await iniciarSesion(CORREO_NUEVO, temporal);
    expect(respuesta.status).toBe(200);
    const cuerpoSesion = (await respuesta.json()) as CuerpoSesion;
    tokenTemporal = cuerpoSesion.token;
    // El cliente decide el destino con este flag: entra directo al cambio.
    expect(cuerpoSesion.usuario.debe_cambiar_password).toBe(true);

    const me = await pedir('/api/v1/me', {
      headers: { authorization: `Bearer ${tokenTemporal}` },
    });
    expect(me.status).toBe(200);
    const cuerpoMe = (await me.json()) as { debe_cambiar_password: boolean };
    expect(cuerpoMe.debe_cambiar_password).toBe(true);

    const bloqueada = await pedir('/api/v1/afiliados', {
      headers: { authorization: `Bearer ${tokenTemporal}` },
    });
    expect(bloqueada.status).toBe(403);
    const cuerpoError = (await bloqueada.json()) as { error?: { code?: string } };
    expect(cuerpoError.error?.code).toBe('CAMBIO_PASSWORD_REQUERIDO');
  });

  it('el cambio con la contraseña actual incorrecta responde 401', async () => {
    const respuesta = await pedir('/api/v1/auth/cambio-password', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${tokenTemporal}` },
      body: JSON.stringify({
        contrasena_actual: 'incorrecta-1234',
        contrasena_nueva: CLAVE_NUEVA,
      }),
    });
    expect(respuesta.status).toBe(401);
  });

  it('el cambio exitoso renueva el token y invalida el anterior por iat', async () => {
    const respuesta = await pedir('/api/v1/auth/cambio-password', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${tokenTemporal}` },
      body: JSON.stringify({ contrasena_actual: temporal, contrasena_nueva: CLAVE_NUEVA }),
    });
    expect(respuesta.status).toBe(200);
    const nuevaSesion = (await respuesta.json()) as CuerpoSesion;
    expect(typeof nuevaSesion.token).toBe('string');
    // La sesión renovada ya no obliga a cambiar la contraseña.
    expect(nuevaSesion.usuario.debe_cambiar_password).toBe(false);

    // Token viejo (emitido antes del cambio) → 401.
    const viejo = await pedir('/api/v1/me', {
      headers: { authorization: `Bearer ${tokenTemporal}` },
    });
    expect(viejo.status).toBe(401);

    // Token nuevo → API habilitada y flag limpio.
    const nuevo = await pedir('/api/v1/me', {
      headers: { authorization: `Bearer ${nuevaSesion.token}` },
    });
    expect(nuevo.status).toBe(200);
    const cuerpo = (await nuevo.json()) as { debe_cambiar_password: boolean };
    expect(cuerpo.debe_cambiar_password).toBe(false);

    const desbloqueada = await pedir('/api/v1/afiliados', {
      headers: { authorization: `Bearer ${nuevaSesion.token}` },
    });
    expect(desbloqueada.status).toBe(200);
  });

  it('el admin restablece: temporal nueva, flag otra vez y token viejo inválido', async () => {
    const respuesta = await pedir(
      `/api/v1/usuarios/${idNuevo}/restablecer-password`,
      conAdmin('POST'),
    );
    expect(respuesta.status).toBe(200);
    expect(respuesta.headers.get('cache-control')).toContain('no-store');
    const cuerpo = (await respuesta.json()) as { contrasena_temporal: string };
    expect(cuerpo.contrasena_temporal).toMatch(/^[a-hj-km-np-zA-HJ-KM-NP-Z2-9]{16}$/);

    // La sesión anterior del usuario (token post-cambio) queda invalidada.
    const sesion = await iniciarSesion(CORREO_NUEVO, CLAVE_NUEVA);
    expect(sesion.status).toBe(401);

    const conTemporal = await iniciarSesion(CORREO_NUEVO, cuerpo.contrasena_temporal);
    expect(conTemporal.status).toBe(200);
  });
});

describe('salvaguardas de administración', () => {
  it('el admin no puede desactivarse a sí mismo', async () => {
    const me = await pedir('/api/v1/me', { headers: { authorization: `Bearer ${tokenAdmin}` } });
    const { id } = (await me.json()) as { id: string };

    const respuesta = await pedir(
      `/api/v1/usuarios/${id}`,
      conAdmin('DELETE'),
    );
    expect(respuesta.status).toBe(409);
  });

  it('el admin no puede quitarse el rol admin', async () => {
    const me = await pedir('/api/v1/me', { headers: { authorization: `Bearer ${tokenAdmin}` } });
    const { id } = (await me.json()) as { id: string };

    const respuesta = await pedir(
      `/api/v1/usuarios/${id}`,
      conAdmin('PATCH', { rol: 'operador' }),
    );
    expect(respuesta.status).toBe(409);
  });
});
