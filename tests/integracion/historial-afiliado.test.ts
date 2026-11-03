/**
 * Integración: Historial de pagos del afiliado y meses adeudados
 * (QASpec, Unidad 2).
 *  - GET /afiliados/{id}/pagos devuelve SOLO las líneas del nadador y su
 *    porción del monto (un pago puede cubrir varios nadadores);
 *  - los rechazados quedan fuera (sus líneas se liberaron, §8.1.5);
 *  - 404 para un afiliado de otra organización o inexistente;
 *  - afiliadoSchema lleva `meses_adeudados` calculado junto a estado_pago.
 *
 * Requiere la base local levantada y con seed (`pnpm test:integracion`).
 * Usa Drizzle directo solo para armar/borrar fixtures — la API se ejercita
 * por HTTP vía app.request, sin red.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, inArray } from 'drizzle-orm';

import { app } from '../../src/server/app';
import { db, sqlClient } from '../../src/server/db/client';
import { afiliados, pagoDetalle, pagos } from '../../src/server/db/schema';

const MARCA = 'historial-afiliado-test';
// CC exige solo dígitos: el sufijo sale de Math.random, no de randomUUID (hex).
const SUFIJO = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');
const DOC_A = `7788${SUFIJO}`;
const DOC_B = `7789${SUFIJO}`;
const INGRESO = '2026-01-15';

let token = '';
let planId = '';
let categoriaId = '';
let nadadorA = '';
let nadadorB = '';

async function login(): Promise<string> {
  const r = await app.request('/api/v1/auth/dev-login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ correo: 'admin@truchas.test' }),
  });
  expect(r.status).toBe(200);
  const sesion = (await r.json()) as { token: string };
  return sesion.token;
}

async function pedir(metodo: string, ruta: string, cuerpo?: unknown): Promise<Response> {
  return app.request(ruta, {
    method: metodo,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    ...(cuerpo !== undefined ? { body: JSON.stringify(cuerpo) } : {}),
  });
}

/** Borra rastros de corridas anteriores/esta corrida (FKs en orden). */
async function limpiar(): Promise<void> {
  const pagosMarcados = await db
    .select({ id: pagos.id })
    .from(pagos)
    .where(eq(pagos.observaciones, MARCA));
  const ids = pagosMarcados.map((p) => p.id);
  if (ids.length > 0) {
    await db.delete(pagoDetalle).where(inArray(pagoDetalle.pagoId, ids));
    await db.delete(pagos).where(inArray(pagos.id, ids));
  }
  await db.delete(afiliados).where(inArray(afiliados.numeroDocumento, [DOC_A, DOC_B]));
}

async function crearAfiliado(documento: string, nombre: string): Promise<string> {
  const r = await pedir('POST', '/api/v1/afiliados', {
    plan_id: planId,
    categoria_id: categoriaId,
    tipo_documento: 'CC',
    numero_documento: documento,
    nombre,
    celular: '3000000009',
    correo: `${documento}@ejemplo.com`,
    tipo_sangre: 'O+',
    fecha_nacimiento: '2014-03-15',
    fecha_ingreso: INGRESO,
  });
  expect(r.status).toBe(201);
  return ((await r.json()) as { id: string }).id;
}

type LineaWire = { concepto: string; fecha_cobertura: string; monto: string };
type PagoHistorial = {
  id: string;
  estado: string;
  monto: string;
  created_at: string;
  lineas: LineaWire[];
};

async function historial(id: string, query = ''): Promise<PagoHistorial[]> {
  const r = await pedir('GET', `/api/v1/afiliados/${id}/pagos${query}`);
  expect(r.status).toBe(200);
  const datos = (await r.json()) as { datos: PagoHistorial[] };
  return datos.datos;
}

beforeAll(async () => {
  await limpiar();
  token = await login();

  const planes = (await (await pedir('GET', '/api/v1/planes?limit=1')).json()) as {
    datos: { id: string }[];
  };
  planId = planes.datos[0]!.id;
  const categorias = (await (await pedir('GET', '/api/v1/categorias?limit=1')).json()) as {
    datos: { id: string }[];
  };
  categoriaId = categorias.datos[0]!.id;

  nadadorA = await crearAfiliado(DOC_A, 'Historial Nadador A');
  nadadorB = await crearAfiliado(DOC_B, 'Historial Nadador B');
});

afterAll(async () => {
  await limpiar();
  await sqlClient.end({ timeout: 5 });
});

describe('GET /afiliados/{id}/pagos — historial con las líneas del nadador', () => {
  it('un pago familiar devuelve SOLO las líneas de cada nadador y su porción', async () => {
    // Pago de dos nadadores: A cubre feb+mar, B cubre feb. Monto total 222000.
    const r = await pedir('POST', '/api/v1/pagos', {
      monto_total: '222000.00',
      factura_tipo_documento: 'CC',
      factura_documento: '1234567890',
      factura_nombre: MARCA,
      observaciones: MARCA,
      lineas: [
        { afiliado_id: nadadorA, concepto: 'mensualidad', fecha_cobertura: '2026-02-01', monto: '74000.00' },
        { afiliado_id: nadadorA, concepto: 'mensualidad', fecha_cobertura: '2026-03-01', monto: '74000.00' },
        { afiliado_id: nadadorB, concepto: 'mensualidad', fecha_cobertura: '2026-02-01', monto: '74000.00' },
      ],
    });
    expect(r.status).toBe(201);

    const deA = await historial(nadadorA);
    const pagoA = deA.find((p) => p.monto === '148000.00');
    expect(pagoA).toBeDefined();
    expect(pagoA!.lineas).toHaveLength(2);
    // Solo sus meses: feb y mar, nunca la línea de B (que también es feb).
    expect(pagoA!.lineas.map((l) => l.fecha_cobertura).sort()).toEqual(['2026-02-01', '2026-03-01']);
    expect(pagoA!.monto).toBe('148000.00'); // 222000 totales, 148000 de A
    expect(pagoA!.estado).toBe('pendiente');

    const deB = await historial(nadadorB);
    const pagoB = deB.find((p) => p.monto === '74000.00');
    expect(pagoB).toBeDefined();
    expect(pagoB!.lineas).toHaveLength(1);
    expect(pagoB!.lineas[0]!.fecha_cobertura).toBe('2026-02-01');
  });

  it('excluye los pagos rechazados (sus líneas se liberaron)', async () => {
    const creado = await pedir('POST', '/api/v1/pagos', {
      monto_total: '74000.00',
      factura_tipo_documento: 'CC',
      factura_documento: '1234567890',
      factura_nombre: MARCA,
      observaciones: MARCA,
      lineas: [
        { afiliado_id: nadadorB, concepto: 'mensualidad', fecha_cobertura: '2026-04-01', monto: '74000.00' },
      ],
    });
    expect(creado.status).toBe(201);
    const id = ((await creado.json()) as { id: string }).id;

    const rechazo = await pedir('PATCH', `/api/v1/pagos/${id}/estado`, { estado: 'rechazado' });
    expect(rechazo.status).toBe(200);

    const deB = await historial(nadadorB);
    expect(deB.map((p) => p.id)).not.toContain(id);
  });

  it('respeta el límite y 404 para un afiliado inexistente', async () => {
    const pocos = await historial(nadadorA, '?limit=1');
    expect(pocos.length).toBeLessThanOrEqual(1);

    const r = await pedir('GET', `/api/v1/afiliados/${randomUUID()}/pagos`);
    expect(r.status).toBe(404);
    const error = (await r.json()) as { error: { code: string } };
    expect(error.error.code).toBe('NO_ENCONTRADO');
  });
});

describe('afiliadoSchema — meses_adeudados calculado', () => {
  it('viene en el listado y en el detalle, junto a estado_pago', async () => {
    const lista = (await (await pedir('GET', '/api/v1/afiliados?limit=100')).json()) as {
      datos: { id: string; estado_pago: string | null; meses_adeudados: string[] }[];
    };
    expect(lista.datos.length).toBeGreaterThan(0);
    for (const fila of lista.datos) {
      expect(Array.isArray(fila.meses_adeudados)).toBe(true);
      if (fila.estado_pago !== 'en_mora') expect(fila.meses_adeudados).toHaveLength(0);
      else expect(fila.meses_adeudados.length).toBeGreaterThan(0);
    }

    const detalle = (await (await pedir('GET', `/api/v1/afiliados/${nadadorA}`)).json()) as {
      estado_pago: string | null;
      meses_adeudados: string[];
    };
    expect(Array.isArray(detalle.meses_adeudados)).toBe(true);
    // Sin pagos verificados y en mora por el pago pendiente: ≥1 mes adeudado.
    expect(detalle.estado_pago).toBe('en_mora');
    expect(detalle.meses_adeudados.length).toBeGreaterThan(0);
  });
});
