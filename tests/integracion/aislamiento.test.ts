/**
 * Integración: aislamiento entre DOS organizaciones (specplan Fase 3).
 * Cubre afiliados, planes y pagos, incluido intentar referenciar un plan ajeno.
 *
 * Requiere la base local levantada y con seed (`pnpm db:migrate && pnpm db:seed`);
 * se corre con `pnpm test:integracion`. Usa Drizzle directo solo para montar el
 * arreglo (organización y usuario de prueba) — la API se ejercita por HTTP
 * vía app.request, sin red.
 *
 * Convención de errores: recurso ajeno → 404 (nunca 403); referencia inválida
 * en creación (FK compuesta) → 422 REFERENCIA_INVALIDA.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, inArray } from 'drizzle-orm';

import { app } from '../../src/server/app';
import { db, sqlClient } from '../../src/server/db/client';
import {
  afiliados,
  categorias,
  organizaciones,
  pagoDetalle,
  pagos,
  planes,
  roles,
  usuarios,
} from '../../src/server/db/schema';

const SLUG = 'aislamiento-test';
const CORREO_ORG2 = 'admin@aislamiento.test';
const PLAN_AJENO = 'Plan Aislamiento Test';
const DOC_AFILIADO = '779999000111';
const MARCA_PAGO = 'pago-aislamiento-test';

let token1 = '';
let token2 = '';
let planOrg1 = '';
let categoriaOrg1 = '';
let categoriaOrg2 = '';
let afiliadoOrg1 = '';
let pagoOrg1 = '';

async function login(correo: string): Promise<string> {
  const r = await app.request('/api/v1/auth/dev-login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ correo }),
  });
  expect(r.status).toBe(200);
  const sesion = (await r.json()) as { token: string };
  return sesion.token;
}

async function pedir(
  metodo: string,
  ruta: string,
  opciones: { token?: string; cuerpo?: unknown } = {},
): Promise<Response> {
  return app.request(ruta, {
    method: metodo,
    headers: {
      'content-type': 'application/json',
      ...(opciones.token ? { authorization: `Bearer ${opciones.token}` } : {}),
    },
    ...(opciones.cuerpo !== undefined ? { body: JSON.stringify(opciones.cuerpo) } : {}),
  });
}

/** Borra todos los rastros de corridas anteriores/esta corrida (FKs en orden). */
async function limpiar(): Promise<void> {
  const pagosMarcados = await db
    .select({ id: pagos.id })
    .from(pagos)
    .where(eq(pagos.observaciones, MARCA_PAGO));
  const idsPagos = pagosMarcados.map((p) => p.id);
  if (idsPagos.length > 0) {
    await db.delete(pagoDetalle).where(inArray(pagoDetalle.pagoId, idsPagos));
    await db.delete(pagos).where(inArray(pagos.id, idsPagos));
  }
  await db.delete(afiliados).where(eq(afiliados.numeroDocumento, DOC_AFILIADO));
  await db.delete(planes).where(eq(planes.nombre, PLAN_AJENO));
  // Categorías de prueba en AMBAS organizaciones (la de la org1 no se alcanza
  // a borrar en el loop de abajo porque su organización no se elimina).
  await db
    .delete(categorias)
    .where(inArray(categorias.nombre, ['Aislamiento-Mayores', 'Aislamiento-Infantil']));
  const previas = await db
    .select({ id: organizaciones.id })
    .from(organizaciones)
    .where(eq(organizaciones.slug, SLUG));
  for (const org of previas) {
    await db.delete(categorias).where(eq(categorias.organizacionId, org.id));
    await db.delete(usuarios).where(eq(usuarios.organizacionId, org.id));
    await db.delete(organizaciones).where(eq(organizaciones.id, org.id));
  }
}

beforeAll(async () => {
  await limpiar();

  token1 = await login('admin@truchas.test');

  // Organización 2 con su admin (el seed solo crea Truchas).
  const [org2] = await db
    .insert(organizaciones)
    .values({ nombre: 'Org Aislamiento', slug: SLUG })
    .returning({ id: organizaciones.id });
  const [rolAdmin] = await db
    .select({ id: roles.id })
    .from(roles)
    .where(eq(roles.nombre, 'admin'));
  await db.insert(usuarios).values({
    organizacionId: org2!.id,
    rolId: rolAdmin!.id,
    correo: CORREO_ORG2,
    nombre: 'Admin Aislamiento',
  });
  token2 = await login(CORREO_ORG2);

  // Fixtures por API: plan y afiliado solo en org1; categoría en cada org.
  const rPlan = await pedir('POST', '/api/v1/planes', {
    token: token1,
    cuerpo: { nombre: PLAN_AJENO, valor_mensualidad: '74000.00', valor_matricula: '80000.00' },
  });
  expect(rPlan.status).toBe(201);
  planOrg1 = ((await rPlan.json()) as { id: string }).id;

  const rCat1 = await pedir('POST', '/api/v1/categorias', {
    token: token1,
    cuerpo: { nombre: 'Aislamiento-Mayores' },
  });
  expect(rCat1.status).toBe(201);
  categoriaOrg1 = ((await rCat1.json()) as { id: string }).id;

  const rCat2 = await pedir('POST', '/api/v1/categorias', {
    token: token2,
    cuerpo: { nombre: 'Aislamiento-Infantil' },
  });
  expect(rCat2.status).toBe(201);
  categoriaOrg2 = ((await rCat2.json()) as { id: string }).id;

  const rAfiliado = await pedir('POST', '/api/v1/afiliados', {
    token: token1,
    cuerpo: {
      plan_id: planOrg1,
      categoria_id: categoriaOrg1,
      tipo_documento: 'CC',
      numero_documento: DOC_AFILIADO,
      nombre: 'Prueba Aislamiento',
      celular: '3000000001',
      correo: 'aislamiento@ejemplo.com',
      tipo_sangre: 'O+',
      fecha_nacimiento: '2014-03-15',
      fecha_ingreso: '2026-02-01',
    },
  });
  expect(rAfiliado.status).toBe(201);
  afiliadoOrg1 = ((await rAfiliado.json()) as { id: string }).id;

  const rPago = await pedir('POST', '/api/v1/pagos', {
    token: token1,
    cuerpo: {
      monto_total: '74000.00',
      factura_tipo_documento: 'CC',
      factura_documento: '1234567890',
      factura_nombre: 'Prueba Aislamiento',
      observaciones: MARCA_PAGO,
      lineas: [
        {
          afiliado_id: afiliadoOrg1,
          concepto: 'mensualidad',
          fecha_cobertura: '2026-03-01',
          monto: '74000.00',
        },
      ],
    },
  });
  expect(rPago.status).toBe(201);
  pagoOrg1 = ((await rPago.json()) as { id: string }).id;
});

afterAll(async () => {
  await limpiar();
  await sqlClient.end({ timeout: 5 });
});

describe('aislamiento de planes', () => {
  it('el listado de cada organización solo contiene sus planes', async () => {
    const r1 = await pedir('GET', '/api/v1/planes', { token: token1 });
    const p1 = (await r1.json()) as { datos: { id: string }[] };
    expect(p1.datos.some((p) => p.id === planOrg1)).toBe(true);

    const r2 = await pedir('GET', '/api/v1/planes', { token: token2 });
    const p2 = (await r2.json()) as { datos: { id: string }[] };
    expect(p2.datos.some((p) => p.id === planOrg1)).toBe(false);
  });

  it('GET de un plan ajeno → 404 (nunca 403)', async () => {
    const ajeno = await pedir('GET', `/api/v1/planes/${planOrg1}`, { token: token2 });
    expect(ajeno.status).toBe(404);
    const error = (await ajeno.json()) as { error: { code: string } };
    expect(error.error.code).toBe('NO_ENCONTRADO');

    const propio = await pedir('GET', `/api/v1/planes/${planOrg1}`, { token: token1 });
    expect(propio.status).toBe(200);
  });
});

describe('aislamiento de afiliados', () => {
  it('crear un afiliado referenciando un plan ajeno → 422 REFERENCIA_INVALIDA', async () => {
    const r = await pedir('POST', '/api/v1/afiliados', {
      token: token2,
      cuerpo: {
        plan_id: planOrg1, // ← plan de la organización 1
        categoria_id: categoriaOrg2,
        tipo_documento: 'CC',
        numero_documento: '779999000222',
        nombre: 'Intento Cruzado',
        celular: '3000000002',
        correo: 'cruzado@ejemplo.com',
        tipo_sangre: 'A+',
        fecha_nacimiento: '2015-01-10',
        fecha_ingreso: '2026-02-01',
      },
    });
    expect(r.status).toBe(422);
    const error = (await r.json()) as { error: { code: string } };
    expect(error.error.code).toBe('REFERENCIA_INVALIDA');
  });

  it('el afiliado de una organización es invisible para la otra', async () => {
    const lista = await pedir('GET', '/api/v1/afiliados', { token: token2 });
    const datos = (await lista.json()) as { datos: { id: string }[] };
    expect(datos.datos.some((a) => a.id === afiliadoOrg1)).toBe(false);

    const ajeno = await pedir('GET', `/api/v1/afiliados/${afiliadoOrg1}`, { token: token2 });
    expect(ajeno.status).toBe(404);

    const propio = await pedir('GET', `/api/v1/afiliados/${afiliadoOrg1}`, { token: token1 });
    expect(propio.status).toBe(200);
    // estado_pago calculado y serializado contra el esquema (no almacenado).
    const detalle = (await propio.json()) as { estado_pago: string | null; created_at: string };
    expect(['al_dia', 'por_vencer', 'en_mora']).toContain(detalle.estado_pago!);
    expect(typeof detalle.created_at).toBe('string');
  });
});

describe('aislamiento de pagos', () => {
  it('el listado y el detalle de pagos no cruzan de organización', async () => {
    const lista = await pedir('GET', '/api/v1/pagos', { token: token2 });
    const datos = (await lista.json()) as { datos: { id: string }[] };
    expect(datos.datos.some((p) => p.id === pagoOrg1)).toBe(false);

    const ajeno = await pedir('GET', `/api/v1/pagos/${pagoOrg1}`, { token: token2 });
    expect(ajeno.status).toBe(404);

    const propio = await pedir('GET', `/api/v1/pagos/${pagoOrg1}`, { token: token1 });
    expect(propio.status).toBe(200);
  });

  it('no se puede pagar a un afiliado ajeno → 404 uniforme (spec §5.4)', async () => {
    const r = await pedir('POST', '/api/v1/pagos', {
      token: token2,
      cuerpo: {
        monto_total: '74000.00',
        factura_tipo_documento: 'CC',
        factura_documento: '1234567890',
        factura_nombre: 'Prueba Aislamiento',
        observaciones: MARCA_PAGO,
        lineas: [
          {
            afiliado_id: afiliadoOrg1, // ← afiliado de la organización 1
            concepto: 'mensualidad',
            fecha_cobertura: '2026-03-01',
            monto: '74000.00',
          },
        ],
      },
    });
    expect(r.status).toBe(404);
    const error = (await r.json()) as { error: { code: string } };
    expect(error.error.code).toBe('NO_ENCONTRADO');
  });
});
