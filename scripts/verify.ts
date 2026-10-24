/**
 * Verificación de la Fase 1 (datos).
 *
 * 1. Cuenta filas clave tras el seed.
 * 2. Prueba las restricciones críticas (CHECKs, únicos, FKs compuestas
 *    multi-tenant) CADA UNA en su propia transacción con ROLLBACK:
 *    no deja ningún dato en la base.
 *
 * Uso:  pnpm db:migrate && pnpm db:seed && pnpm db:verify
 * Sale con código 1 si alguna verificación falla.
 */
import { eq } from 'drizzle-orm';

import { db, sqlClient } from '../src/server/db/client';
import { pgCode } from '../src/server/db/pg-error';
import {
  acudientes,
  afiliados,
  categorias,
  eps,
  organizaciones,
  pagos,
  pagoDetalle,
  planes,
  roles,
  usuarios,
} from '../src/server/db/schema';

const resultados: { nombre: string; ok: boolean; detalle?: string }[] = [];

function registrar(nombre: string, ok: boolean, detalle?: string): void {
  resultados.push(detalle === undefined ? { nombre, ok } : { nombre, ok, detalle });
}

/** Ejecuta `fn` en una transacción que SIEMPRE hace rollback. */
async function enTransaccion(fn: (tx: typeof db) => unknown): Promise<void> {
  try {
    await db.transaction(async (tx) => {
      await fn(tx as unknown as typeof db);
      throw new Error('__rollback__');
    });
  } catch (err) {
    if ((err as Error).message !== '__rollback__') throw err;
  }
}

/** Espera que la operación falle con un código de Postgres dado (23505, 23514, 23503…). */
async function esperaError(codigoEsperado: string, nombre: string, fn: () => unknown): Promise<void> {
  try {
    await fn();
    registrar(nombre, false, `falló: se esperaba error ${codigoEsperado} y la operación SUCEDIÓ`);
  } catch (err) {
    const codigo = pgCode(err);
    if (codigo === codigoEsperado) {
      registrar(nombre, true);
    } else {
      registrar(nombre, false, `código ${codigo ?? 'desconocido'} (se esperaba ${codigoEsperado})`);
    }
  }
}

async function main(): Promise<void> {
  // ---------------------------------------------------------------------
  // 1. Conteos tras el seed
  // ---------------------------------------------------------------------
  const pruebas: { nombre: string; cuenta: Promise<number>; ok: (c: number) => boolean }[] = [
    { nombre: 'organizaciones = 1', cuenta: db.$count(organizaciones), ok: (c) => c === 1 },
    { nombre: 'roles = 2', cuenta: db.$count(roles), ok: (c) => c === 2 },
    { nombre: 'eps >= 5', cuenta: db.$count(eps), ok: (c) => c >= 5 },
    { nombre: 'planes = 2', cuenta: db.$count(planes), ok: (c) => c === 2 },
    { nombre: 'categorias = 10', cuenta: db.$count(categorias), ok: (c) => c === 10 },
    { nombre: 'usuarios = 2', cuenta: db.$count(usuarios), ok: (c) => c === 2 },
    { nombre: 'afiliados = 5', cuenta: db.$count(afiliados), ok: (c) => c === 5 },
    { nombre: 'pagos > 0', cuenta: db.$count(pagos), ok: (c) => c > 0 },
    { nombre: 'pago_detalle > 0', cuenta: db.$count(pagoDetalle), ok: (c) => c > 0 },
  ];

  for (const p of pruebas) {
    const cuenta = await p.cuenta;
    registrar(p.nombre, p.ok(cuenta), `obtenido: ${cuenta}`);
  }

  // ---------------------------------------------------------------------
  // 2. Datos base para los probes
  // ---------------------------------------------------------------------
  const [org] = await db.select({ id: organizaciones.id }).from(organizaciones).limit(1);
  const [plan] = await db.select({ id: planes.id }).from(planes).limit(1);
  const [categoria] = await db.select({ id: categorias.id }).from(categorias).limit(1);
  const [afiliado] = await db
    .select({
      id: afiliados.id,
      tipoDocumento: afiliados.tipoDocumento,
      numeroDocumento: afiliados.numeroDocumento,
    })
    .from(afiliados)
    .limit(1);
  const [acudientePrincipal] = await db
    .select({ id: acudientes.id, afiliadoId: acudientes.afiliadoId })
    .from(acudientes)
    .where(eq(acudientes.esPrincipal, true))
    .limit(1);
  const [lineaMensualidad] = await db
    .select({
      id: pagoDetalle.id,
      afiliadoId: pagoDetalle.afiliadoId,
      concepto: pagoDetalle.concepto,
      fechaCobertura: pagoDetalle.fechaCobertura,
      monto: pagoDetalle.monto,
      pagoId: pagoDetalle.pagoId,
      organizacionId: pagoDetalle.organizacionId,
    })
    .from(pagoDetalle)
    .limit(1);

  if (!org || !plan || !categoria || !afiliado || !acudientePrincipal || !lineaMensualidad) {
    throw new Error('Faltan datos de seed: correr `pnpm db:seed` antes que `pnpm db:verify`.');
  }

  const afiliadoValues = {
    organizacionId: org.id,
    planId: plan.id,
    categoriaId: categoria.id,
    tipoDocumento: 'CC',
    numeroDocumento: '99999999',
    nombre: 'Probe Temporal',
    celular: '3000000000',
    correo: 'probe@temp.test',
    tipoSangre: 'O+',
    fechaNacimiento: '1990-01-01',
    fechaIngreso: '2026-02-01',
  };

  // ---------------------------------------------------------------------
  // 3. CHECKs
  // ---------------------------------------------------------------------
  await esperaError('23514', 'CHECK tipo_documento (ZZ inválido)', () =>
    enTransaccion((tx) => tx.insert(afiliados).values({ ...afiliadoValues, tipoDocumento: 'ZZ' })),
  );
  await esperaError('23514', 'CHECK numero_documento CC (solo dígitos)', () =>
    enTransaccion((tx) => tx.insert(afiliados).values({ ...afiliadoValues, numeroDocumento: '12AB' })),
  );
  // Pasaportes: alfanumérico en MAYÚSCULAS se inserta; en minúsculas lo rechaza el CHECK.
  await enTransaccion(async (tx) => {
    try {
      await tx
        .insert(afiliados)
        .values({ ...afiliadoValues, tipoDocumento: 'PAS', numeroDocumento: 'AB123456' });
      registrar('CHECK PAS alfanumérico (AB123456) se inserta', true);
    } catch (err) {
      registrar(
        'CHECK PAS alfanumérico (AB123456) se inserta',
        false,
        `falló con ${pgCode(err) ?? (err as Error).message}`,
      );
    }
  });
  await esperaError('23514', 'CHECK PAS en minúsculas (ab123456) rechazado', () =>
    enTransaccion((tx) => tx.insert(afiliados).values({ ...afiliadoValues, tipoDocumento: 'PAS', numeroDocumento: 'ab123456' })),
  );
  await esperaError('23514', 'CHECK tipo_sangre (Z inválido)', () =>
    enTransaccion((tx) => tx.insert(afiliados).values({ ...afiliadoValues, tipoSangre: 'Z' })),
  );
  await esperaError('23514', 'CHECK descuento entre 0 y 1 (1.5)', () =>
    enTransaccion((tx) => tx.insert(afiliados).values({ ...afiliadoValues, descuento: '1.5' })),
  );
  await esperaError('23514', 'CHECK estado de pago ("volando")', () =>
    enTransaccion((tx) =>
      tx.insert(pagos).values({
        organizacionId: org.id,
        montoTotal: '1000.00',
        estado: 'volando',
        facturaTipoDocumento: 'CC',
        facturaDocumento: '11111111',
        facturaNombre: 'Probe',
      }),
    ),
  );
  await esperaError('23514', 'CHECK factura_tipo_documento ("XYZ" inválido)', () =>
    enTransaccion((tx) =>
      tx.insert(pagos).values({
        organizacionId: org.id,
        montoTotal: '1000.00',
        estado: 'pendiente',
        facturaTipoDocumento: 'XYZ',
        facturaDocumento: '11111111',
        facturaNombre: 'Probe',
      }),
    ),
  );
  await esperaError('23514', 'CHECK factura_documento CC (letras rechazadas)', () =>
    enTransaccion((tx) =>
      tx.insert(pagos).values({
        organizacionId: org.id,
        montoTotal: '1000.00',
        estado: 'pendiente',
        facturaTipoDocumento: 'CC',
        facturaDocumento: 'AB12CD',
        facturaNombre: 'Probe',
      }),
    ),
  );
  // NIT con dígito de verificación (alfanumérico con guion) se inserta.
  await enTransaccion(async (tx) => {
    try {
      await tx.insert(pagos).values({
        organizacionId: org.id,
        montoTotal: '1000.00',
        estado: 'pendiente',
        facturaTipoDocumento: 'NIT',
        facturaDocumento: '900123456-1',
        facturaNombre: 'Empresa Probe',
      });
      registrar('CHECK factura NIT con guion (900123456-1) se inserta', true);
    } catch (err) {
      registrar(
        'CHECK factura NIT con guion (900123456-1) se inserta',
        false,
        `falló con ${pgCode(err) ?? (err as Error).message}`,
      );
    }
  });
  await esperaError('23514', 'CHECK fecha_cobertura día 1 (día 15)', () =>
    enTransaccion((tx) =>
      tx.insert(pagoDetalle).values({
        organizacionId: org.id,
        pagoId: lineaMensualidad.pagoId,
        afiliadoId: afiliado.id,
        concepto: 'mensualidad',
        fechaCobertura: '2026-04-15',
        monto: '1000.00',
      }),
    ),
  );
  await esperaError('23514', 'CHECK concepto ("otro")', () =>
    enTransaccion((tx) =>
      tx.insert(pagoDetalle).values({
        organizacionId: org.id,
        pagoId: lineaMensualidad.pagoId,
        afiliadoId: afiliado.id,
        concepto: 'otro',
        fechaCobertura: '2026-04-01',
        monto: '1000.00',
      }),
    ),
  );

  // ---------------------------------------------------------------------
  // 4. Únicos
  // ---------------------------------------------------------------------
  await esperaError('23505', 'UNIQUE afiliado (org, tipo, documento) duplicado', () =>
    enTransaccion((tx) =>
      tx.insert(afiliados).values({
        ...afiliadoValues,
        tipoDocumento: afiliado.tipoDocumento,
        numeroDocumento: afiliado.numeroDocumento,
      }),
    ),
  );
  await esperaError('23505', 'UNIQUE pago_detalle (afiliado, concepto, mes) duplicado', () =>
    enTransaccion((tx) =>
      tx.insert(pagoDetalle).values({
        organizacionId: org.id,
        pagoId: lineaMensualidad.pagoId,
        afiliadoId: lineaMensualidad.afiliadoId,
        concepto: lineaMensualidad.concepto,
        fechaCobertura: lineaMensualidad.fechaCobertura,
        monto: lineaMensualidad.monto,
      }),
    ),
  );
  await esperaError('23505', 'UNIQUE parcial: un solo acudiente principal por afiliado', () =>
    enTransaccion((tx) =>
      tx.insert(acudientes).values({
        organizacionId: org.id,
        afiliadoId: acudientePrincipal.afiliadoId,
        numeroDocumento: '8888888888',
        nombre: 'Segundo principal',
        esPrincipal: true,
      }),
    ),
  );

  // ---------------------------------------------------------------------
  // 5. Multi-tenant a nivel de datos: FK compuesta rechaza plan ajeno
  // ---------------------------------------------------------------------
  await enTransaccion(async (tx) => {
    const [orgB] = await tx
      .insert(organizaciones)
      .values({ nombre: 'Org Probe', slug: 'org-probe' })
      .returning({ id: organizaciones.id });
    const [categoriaB] = await tx
      .insert(categorias)
      .values({ organizacionId: orgB!.id, nombre: 'Categoria B' })
      .returning({ id: categorias.id });

    await esperaError('23503', 'FK compuesta: afiliado NO puede referenciar plan de otra organización', () =>
      tx.insert(afiliados).values({
        ...afiliadoValues,
        organizacionId: orgB!.id,
        categoriaId: categoriaB!.id,
        planId: plan.id, // plan de org A → debe fallar
      }),
    );
  });

  // ---------------------------------------------------------------------
  // Reporte
  // ---------------------------------------------------------------------
  let fallidos = 0;
  console.log('\n=== Fase 1 · verificación de datos ===');
  for (const r of resultados) {
    if (!r.ok) fallidos += 1;
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.nombre}${r.ok ? '' : ` — ${r.detalle ?? ''}`}`);
  }
  console.log(`\n${resultados.length - fallidos}/${resultados.length} verificaciones OK`);
  if (fallidos > 0) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error('verify falló:', err);
    process.exitCode = 1;
  })
  .finally(() => sqlClient.end({ timeout: 5 }));
