/**
 * Integración: reglas nuevas de pagos y orden de afiliados (post-Fase 5).
 *  - POST /pagos rechaza coberturas ANTERIORES al mes de ingreso → 400;
 *  - POST /pagos rechaza mensualidades de enero → 400 (enero = matrícula);
 *  - GET /pagos filtra por factura (texto parcial) y por revisado_desde/hasta;
 *  - GET /afiliados ordena por documento/nombre asc/desc con cursor estable.
 *
 * Requiere la base local levantada y con seed (`pnpm test:integracion`).
 * Usa Drizzle directo solo para armar/borrar fixtures — la API se ejercita
 * por HTTP vía app.request, sin red. Orden por DOCUMENTO: los números de
 * documento comparan igual en cualquier collación (solo dígitos).
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, inArray } from 'drizzle-orm';

import { app } from '../../src/server/app';
import { db, sqlClient } from '../../src/server/db/client';
import { afiliados, pagoDetalle, pagos } from '../../src/server/db/schema';

const MARCA = 'pagos-orden-test';
const DOC_PRUEBA = '779999000777';
const INGRESO = '2026-06-15';

let token = '';
let planId = '';
let categoriaId = '';
let afiliadoId = '';
let pagoVerificadoId = '';
let facturaUnica = '';

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

async function pedir(
  metodo: string,
  ruta: string,
  cuerpo?: unknown,
): Promise<Response> {
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
  const marcados = await db
    .select({ id: pagos.id })
    .from(pagos)
    .where(eq(pagos.observaciones, MARCA));
  const ids = marcados.map((p) => p.id);
  if (ids.length > 0) {
    await db.delete(pagoDetalle).where(inArray(pagoDetalle.pagoId, ids));
    await db.delete(pagos).where(inArray(pagos.id, ids));
  }
  await db.delete(afiliados).where(eq(afiliados.numeroDocumento, DOC_PRUEBA));
}

function diaDesplazado(dias: number): string {
  const fecha = new Date();
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
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

  const rAfiliado = await pedir('POST', '/api/v1/afiliados', {
    plan_id: planId,
    categoria_id: categoriaId,
    tipo_documento: 'CC',
    numero_documento: DOC_PRUEBA,
    nombre: 'Prueba Pagos Orden',
    celular: '3000000007',
    correo: 'pagos-orden@ejemplo.com',
    tipo_sangre: 'O+',
    fecha_nacimiento: '2014-03-15',
    fecha_ingreso: INGRESO,
  });
  expect(rAfiliado.status).toBe(201);
  afiliadoId = ((await rAfiliado.json()) as { id: string }).id;

  facturaUnica = `PagosOrden-${randomUUID().slice(0, 8)}`;
});

afterAll(async () => {
  await limpiar();
  await sqlClient.end({ timeout: 5 });
});

describe('POST /pagos — cobertura nunca previa a la inscripción', () => {
  it('un mes anterior al mes de ingreso → 400 VALIDACION', async () => {
    const r = await pedir('POST', '/api/v1/pagos', {
      monto_total: '74000.00',
      factura_tipo_documento: 'CC',
      factura_documento: '1234567890',
      factura_nombre: facturaUnica,
      observaciones: MARCA,
      lineas: [
        {
          afiliado_id: afiliadoId,
          concepto: 'mensualidad',
          fecha_cobertura: '2026-05-01', // ← previo a ingreso 2026-06-15
          monto: '74000.00',
        },
      ],
    });
    expect(r.status).toBe(400);
    const error = (await r.json()) as { error: { code: string; message: string } };
    expect(error.error.code).toBe('VALIDACION');
    expect(error.error.message).toContain('anteriores al mes de ingreso');
  });

  it('una mensualidad de enero → 400 (enero lo cubre la matrícula)', async () => {
    const r = await pedir('POST', '/api/v1/pagos', {
      monto_total: '74000.00',
      factura_tipo_documento: 'CC',
      factura_documento: '1234567890',
      factura_nombre: facturaUnica,
      observaciones: MARCA,
      lineas: [
        {
          afiliado_id: afiliadoId,
          concepto: 'mensualidad',
          fecha_cobertura: '2027-01-01',
          monto: '74000.00',
        },
      ],
    });
    expect(r.status).toBe(400);
    const texto = JSON.stringify(await r.json());
    expect(texto).toContain('enero lo cubre la matrícula');
  });

  it('el mes del ingreso y meses posteriores sí se aceptan (multi-año)', async () => {
    const r = await pedir('POST', '/api/v1/pagos', {
      monto_total: '148000.00',
      factura_tipo_documento: 'CC',
      factura_documento: '1234567890',
      factura_nombre: facturaUnica,
      observaciones: MARCA,
      lineas: [
        {
          afiliado_id: afiliadoId,
          concepto: 'mensualidad',
          fecha_cobertura: '2026-06-01', // mes de ingreso
          monto: '74000.00',
        },
        {
          afiliado_id: afiliadoId,
          concepto: 'mensualidad',
          fecha_cobertura: '2027-02-01', // año siguiente, mezclado
          monto: '74000.00',
        },
      ],
    });
    expect(r.status).toBe(201);
    pagoVerificadoId = ((await r.json()) as { id: string }).id;
  });
});

describe('GET /pagos — filtros de factura y revisado', () => {
  it('factura hace búsqueda parcial y encuentra el pago recién creado', async () => {
    const r = await pedir('GET', `/api/v1/pagos?factura=${facturaUnica}`);
    expect(r.status).toBe(200);
    const datos = (await r.json()) as { datos: { id: string; factura_nombre: string }[] };
    expect(datos.datos.map((p) => p.id)).toContain(pagoVerificadoId);
  });

  it('factura sin coincidencias devuelve vacío', async () => {
    const r = await pedir('GET', '/api/v1/pagos?factura=zzz-no-existe-zzz');
    expect(r.status).toBe(200);
    const datos = (await r.json()) as { datos: unknown[] };
    expect(datos.datos).toHaveLength(0);
  });

  it('revisado_desde/hasta encuadran el pago verificado y lo excluyen fuera de rango', async () => {
    await pedir('PATCH', `/api/v1/pagos/${pagoVerificadoId}/estado`, { estado: 'verificado' });

    const dentro = await pedir(
      'GET',
      `/api/v1/pagos?revisado_desde=${diaDesplazado(-2)}&revisado_hasta=${diaDesplazado(2)}`,
    );
    expect(dentro.status).toBe(200);
    const datosDentro = (await dentro.json()) as { datos: { id: string }[] };
    expect(datosDentro.datos.map((p) => p.id)).toContain(pagoVerificadoId);

    const fuera = await pedir(
      'GET',
      `/api/v1/pagos?revisado_desde=${diaDesplazado(-10)}&revisado_hasta=${diaDesplazado(-9)}`,
    );
    expect(fuera.status).toBe(200);
    const datosFuera = (await fuera.json()) as { datos: { id: string }[] };
    expect(datosFuera.datos.map((p) => p.id)).not.toContain(pagoVerificadoId);
  });
});

describe('GET /afiliados — orden por columna con cursor', () => {
  it('orden=documento&direccion=desc pagina sin repetir y en orden descendente', async () => {
    const primera = (await (
      await pedir('GET', '/api/v1/afiliados?orden=documento&direccion=desc&limit=3')
    ).json()) as { datos: { numero_documento: string }[]; paginacion: { cursor_siguiente: string | null } };
    expect(primera.datos.length).toBeGreaterThan(0);
    for (let i = 1; i < primera.datos.length; i += 1) {
      expect(primera.datos[i - 1]!.numero_documento >= primera.datos[i]!.numero_documento).toBe(true);
    }

    const cursor = primera.paginacion.cursor_siguiente;
    if (!cursor) {
      // Semilla con ≤3 afiliados: no hay página 2 que seguir (no es un fallo).
      expect(primera.datos.length).toBeLessThanOrEqual(3);
      return;
    }
    const segunda = (await (
      await pedir(
        'GET',
        `/api/v1/afiliados?orden=documento&direccion=desc&limit=3&cursor=${encodeURIComponent(cursor)}`,
      )
    ).json()) as { datos: { numero_documento: string }[] };
    const vistos = new Set(primera.datos.map((a) => a.numero_documento));
    for (const fila of segunda.datos) {
      expect(vistos.has(fila.numero_documento)).toBe(false);
    }
    const ultima = primera.datos.at(-1)!.numero_documento;
    for (const fila of segunda.datos) {
      expect(ultima >= fila.numero_documento).toBe(true);
    }
  });

  it('orden=documento&direccion=asc devuelve la primera página ascendente', async () => {
    const r = await pedir('GET', '/api/v1/afiliados?orden=documento&direccion=asc&limit=3');
    expect(r.status).toBe(200);
    const datos = (await r.json()) as { datos: { numero_documento: string }[] };
    for (let i = 1; i < datos.datos.length; i += 1) {
      expect(datos.datos[i - 1]!.numero_documento <= datos.datos[i]!.numero_documento).toBe(true);
    }
  });

  it('el filtro de estado calculado convive con el orden sin error', async () => {
    const r = await pedir(
      'GET',
      '/api/v1/afiliados?estado_pago=al_dia&orden=documento&direccion=desc&limit=5',
    );
    expect(r.status).toBe(200);
    const datos = (await r.json()) as { datos: { numero_documento: string; estado_pago: string }[] };
    for (const fila of datos.datos) expect(fila.estado_pago).toBe('al_dia');
    for (let i = 1; i < datos.datos.length; i += 1) {
      expect(datos.datos[i - 1]!.numero_documento >= datos.datos[i]!.numero_documento).toBe(true);
    }
  });
});
