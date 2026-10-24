/**
 * Seed de desarrollo — organización demo "Truchas" con datos suficientes
 * para desarrollar y probar el MVP.
 *
 * Uso:   pnpm db:migrate && pnpm db:seed
 * Idempotente: si la organización "truchas" ya existe, no hace nada.
 *
 * Nota: en esta capa se usa el cliente Drizzle directamente; las capas
 * routes → services → repositories son para la API (Fase 3), no para seeds.
 */
import { eq } from 'drizzle-orm';

import { db } from '../src/server/db/client';
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

// ---------------------------------------------------------------------------
// Utilidades de fechas y dinero (seed solamente; la lógica real vive en services)
// ---------------------------------------------------------------------------

const HOY = new Date();
const ANIO_ACTUAL = HOY.getFullYear();
const MES_ACTUAL = HOY.getMonth() + 1; // 1..12

/** Meses facturables de Truchas: febrero (2) a diciembre (12). Enero no se cobra. */
const MES_PRIMERO_FACTURABLE = 2;

const dinero = (n: number): string => n.toFixed(2);

type Mes = { anio: number; mes: number };

function restarMeses(desde: Mes, k: number): Mes {
  const idx = desde.anio * 12 + (desde.mes - 1) - k;
  return { anio: Math.floor(idx / 12), mes: (idx % 12) + 1 };
}

function sumarMeses(desde: Mes, k: number): Mes {
  const idx = desde.anio * 12 + (desde.mes - 1) + k;
  return { anio: Math.floor(idx / 12), mes: (idx % 12) + 1 };
}

/** Todos los meses facturables desde `desde` hasta `hasta` (inclusive). */
function mesesFacturables(desde: Mes, hasta: Mes): Mes[] {
  const salida: Mes[] = [];
  let actual: Mes = { ...desde };
  while (actual.anio < hasta.anio || (actual.anio === hasta.anio && actual.mes <= hasta.mes)) {
    if (actual.mes >= MES_PRIMERO_FACTURABLE) salida.push({ ...actual });
    const siguiente = actual.mes + 1;
    actual = siguiente > 12 ? { anio: actual.anio + 1, mes: 1 } : { anio: actual.anio, mes: siguiente };
  }
  return salida;
}

const aCobertura = (m: Mes): string => `${m.anio}-${String(m.mes).padStart(2, '0')}-01`;

// ---------------------------------------------------------------------------
// Catálogo demo (valores tomados del formulario y las hojas de Truchas)
// ---------------------------------------------------------------------------

const EPS_SEED = ['SURA', 'Nueva EPS', 'Sanitas', 'Salud Total', 'Famisanar'];

// Valores de mensualidad: datos de demostración (los de Truchas se cargan en la migración).
// La matrícula 74000 sí sale del formulario de pago actual de Truchas.
const PLANES_SEED = [
  { nombre: 'Básico', valorMensualidad: dinero(120_000), valorMatricula: dinero(74_000) },
  { nombre: 'Pro', valorMensualidad: dinero(180_000), valorMatricula: dinero(74_000) },
];

const CATEGORIAS_SEED = [
  'Equipo competitivo',
  'Semillero de iniciación',
  'Semillero avanzado A',
  'Semillero avanzado B',
  'Iniciación 2 para niños',
  'Iniciación 1A para niños',
  'Iniciación 1B para niños',
  'Equipo máster',
  'Semillero Máster',
  'Iniciación adultos',
];

type Cobertura = 'al_dia' | 'mora' | 'retirada';

type AfiliadoSeed = {
  tipoDocumento: string;
  numeroDocumento: string;
  nombre: string;
  celular: string;
  correo: string;
  tipoSangre: string;
  fechaNacimiento: string;
  genero: string;
  plan: string;
  categoria: string;
  fechaIngreso: Mes;
  descuento: string;
  cobertura: Cobertura;
  fechaRetiro?: string;
  motivoRetiro?: string;
  acudiente?: { numeroDocumento: string; nombre: string; celular: string; correo: string };
};

const AFILIADOS_SEED: AfiliadoSeed[] = [
  {
    tipoDocumento: 'CC',
    numeroDocumento: '1032456789',
    nombre: 'Julieta Castaño Pérez',
    celular: '3001234567',
    correo: 'julieta.castano@example.com',
    tipoSangre: 'O+',
    fechaNacimiento: '1994-05-12',
    genero: 'F',
    plan: 'Pro',
    categoria: 'Equipo competitivo',
    fechaIngreso: { anio: 2026, mes: 2 },
    descuento: '0',
    cobertura: 'al_dia',
  },
  {
    tipoDocumento: 'TI',
    numeroDocumento: '1098123456',
    nombre: 'Mateo Rodríguez Gómez',
    celular: '3009876543',
    correo: 'mateo.rodriguez@example.com',
    tipoSangre: 'A+',
    fechaNacimiento: '2016-09-03',
    genero: 'M',
    plan: 'Básico',
    categoria: 'Semillero de iniciación',
    fechaIngreso: { anio: 2026, mes: 2 },
    descuento: '0',
    cobertura: 'al_dia',
    acudiente: {
      numeroDocumento: '7987654321',
      nombre: 'Laura Gómez Pérez',
      celular: '3019876543',
      correo: 'laura.gomez@example.com',
    },
  },
  {
    // En mora: falta agosto-octubre. Un pago PENDIENTE con esos 3 meses
    // sirve para probar el flujo de verificación en la Fase 3.
    tipoDocumento: 'CC',
    numeroDocumento: '87654321',
    nombre: 'Andrés Suárez Díaz',
    celular: '3101112233',
    correo: 'andres.suarez@example.com',
    tipoSangre: 'B-',
    fechaNacimiento: '1988-11-30',
    genero: 'M',
    plan: 'Básico',
    categoria: 'Iniciación adultos',
    fechaIngreso: { anio: 2026, mes: 3 },
    descuento: '0.10',
    cobertura: 'mora',
  },
  {
    tipoDocumento: 'CC',
    numeroDocumento: '45123987',
    nombre: 'Camila Herrera López',
    celular: '3155556677',
    correo: 'camila.herrera@example.com',
    tipoSangre: 'AB+',
    fechaNacimiento: '1999-01-22',
    genero: 'F',
    plan: 'Pro',
    categoria: 'Equipo máster',
    fechaIngreso: { anio: 2026, mes: 2 },
    descuento: '0',
    cobertura: 'retirada',
    fechaRetiro: '2026-06-15',
    motivoRetiro: 'Cambio de ciudad',
  },
  {
    tipoDocumento: 'TI',
    numeroDocumento: '1102987654',
    nombre: 'Valentina Ortiz Ramos',
    celular: '3123334455',
    correo: 'valentina.ortiz@example.com',
    tipoSangre: 'O-',
    fechaNacimiento: '2014-07-19',
    genero: 'F',
    plan: 'Pro',
    categoria: 'Semillero avanzado A',
    fechaIngreso: { anio: 2026, mes: 8 },
    descuento: '0',
    cobertura: 'al_dia',
    acudiente: {
      numeroDocumento: '8123456789',
      nombre: 'Diego Ortiz Ramos',
      celular: '3187778899',
      correo: 'diego.ortiz@example.com',
    },
  },
];

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

type AfiliadoInsertado = { id: string; def: AfiliadoSeed };

async function main(): Promise<void> {
  const existente = await db
    .select({ id: organizaciones.id })
    .from(organizaciones)
    .where(eq(organizaciones.slug, 'truchas'))
    .limit(1);

  if (existente.length > 0) {
    console.log('Seed ya aplicado (organización "truchas" existe). No se hizo nada.');
    return;
  }

  const planesRows: { id: string; nombre: string; valorMensualidad: string; valorMatricula: string }[] = [];
  const afiliadosInsertados: AfiliadoInsertado[] = [];
  let categoriasCreadas = 0;
  let pagosCreados = 0;

  // Todo el seed corre en UNA transacción: o se aplica completo o no deja nada.
  await db.transaction(async (tx) => {
    // 1. Organización, roles y catálogos globales
    const [org] = await tx
      .insert(organizaciones)
      .values({ nombre: 'Corporación Truchas de Natación', slug: 'truchas' })
      .returning({ id: organizaciones.id });
    if (!org) throw new Error('No se pudo crear la organización demo');
    const organizacionId = org.id;

    await tx
      .insert(roles)
      .values([
        { id: 1, nombre: 'admin' },
        { id: 2, nombre: 'operador' },
      ])
      .onConflictDoNothing();

    await tx.insert(eps).values(EPS_SEED.map((nombre) => ({ nombre }))).onConflictDoNothing();

    // 2. Planes y categorías de la organización
    const planesInsertados = await tx
      .insert(planes)
      .values(PLANES_SEED.map((p) => ({ organizacionId, ...p })))
      .returning({ id: planes.id, nombre: planes.nombre, valorMensualidad: planes.valorMensualidad, valorMatricula: planes.valorMatricula });
    planesRows.push(...planesInsertados);

    const categoriasInsertadas = await tx
      .insert(categorias)
      .values(CATEGORIAS_SEED.map((nombre) => ({ organizacionId, nombre })))
      .returning({ id: categorias.id, nombre: categorias.nombre });
    categoriasCreadas = categoriasInsertadas.length;

    // 3. Usuarios (los correos son los que usa el dev-login de la Fase 2)
    await tx.insert(usuarios).values([
      { organizacionId, rolId: 1, correo: 'admin@truchas.test', nombre: 'Admin Truchas' },
      { organizacionId, rolId: 2, correo: 'operador@truchas.test', nombre: 'Operador Truchas' },
    ]);

    const planPorNombre = new Map(planesInsertados.map((p) => [p.nombre, p]));
    const categoriaPorNombre = new Map(categoriasInsertadas.map((c) => [c.nombre, c]));

    // 4. Afiliados + acudientes
    for (const def of AFILIADOS_SEED) {
      const plan = planPorNombre.get(def.plan);
      const categoria = categoriaPorNombre.get(def.categoria);
      if (!plan || !categoria) throw new Error(`Plan o categoría faltante: ${def.plan} / ${def.categoria}`);

      const [afiliado] = await tx
        .insert(afiliados)
        .values({
          organizacionId,
          planId: plan.id,
          categoriaId: categoria.id,
          tipoDocumento: def.tipoDocumento,
          numeroDocumento: def.numeroDocumento,
          nombre: def.nombre,
          celular: def.celular,
          correo: def.correo,
          tipoSangre: def.tipoSangre,
          fechaNacimiento: def.fechaNacimiento,
          genero: def.genero,
          descuento: def.descuento,
          fechaIngreso: aCobertura(def.fechaIngreso),
          fechaRetiro: def.fechaRetiro,
          motivoRetiro: def.motivoRetiro,
          activo: def.cobertura !== 'retirada',
        })
        .returning({ id: afiliados.id });
      if (!afiliado) throw new Error(`No se pudo insertar afiliado ${def.nombre}`);
      afiliadosInsertados.push({ id: afiliado.id, def });

      if (def.acudiente) {
        await tx.insert(acudientes).values({
          organizacionId,
          afiliadoId: afiliado.id,
          numeroDocumento: def.acudiente.numeroDocumento,
          nombre: def.acudiente.nombre,
          celular: def.acudiente.celular,
          correo: def.acudiente.correo,
          esPrincipal: true,
        });
      }
    }

    // 5. Pagos: matrícula + mensualidades verificadas según la cobertura de cada uno
    async function crearPago(
      afiliadoId: string,
      factura: { tipoDocumento: string; documento: string; nombre: string; celular: string; correo: string },
      lineas: { concepto: 'mensualidad' | 'matricula'; fechaCobertura: string; monto: string }[],
      estado: 'verificado' | 'pendiente',
      observaciones?: string,
    ): Promise<void> {
      const montoTotal = dinero(lineas.reduce((suma, l) => suma + Number(l.monto), 0));
      const [pago] = await tx
        .insert(pagos)
        .values({
          organizacionId,
          montoTotal,
          estado,
          facturaTipoDocumento: factura.tipoDocumento,
          facturaDocumento: factura.documento,
          facturaNombre: factura.nombre,
          facturaCelular: factura.celular,
          facturaCorreo: factura.correo,
          observaciones: observaciones ?? null,
        })
        .returning({ id: pagos.id });
      if (!pago) throw new Error('No se pudo crear el pago');
      await tx.insert(pagoDetalle).values(
        lineas.map((l) => ({ organizacionId, pagoId: pago.id, afiliadoId, ...l })),
      );
      pagosCreados += 1;
    }

    for (const { id: afiliadoId, def } of afiliadosInsertados) {
      const plan = planPorNombre.get(def.plan)!;
      const esMenor = def.tipoDocumento === 'TI' && def.acudiente !== undefined;
      // El snapshot de facturación lleva tipo de documento propio (spec §8.1):
      // el acudiente que paga es adulto con CC; el afiliado mayor usa su propio tipo.
      const factura = esMenor
        ? {
            tipoDocumento: 'CC',
            documento: def.acudiente!.numeroDocumento,
            nombre: def.acudiente!.nombre,
            celular: def.acudiente!.celular,
            correo: def.acudiente!.correo,
          }
        : {
            tipoDocumento: def.tipoDocumento,
            documento: def.numeroDocumento,
            nombre: def.nombre,
            celular: def.celular,
            correo: def.correo,
          };

      // Matrícula: línea concepto 'matricula' con fecha_cobertura = 1 de enero del año (spec §8.2).
      await crearPago(afiliadoId, factura, [
        { concepto: 'matricula', fechaCobertura: `${def.fechaIngreso.anio}-01-01`, monto: plan.valorMatricula },
      ], 'verificado');

      // Fin de la cobertura verificada según el escenario del afiliado.
      const hoy: Mes = { anio: ANIO_ACTUAL, mes: MES_ACTUAL };
      const fin: Mes =
        def.cobertura === 'al_dia'
          ? hoy
          : def.cobertura === 'mora'
            ? restarMeses(hoy, 3) // quedan 3 meses sin pagar → en mora
            : { anio: 2026, mes: 6 }; // retiro en junio

      const valorMensualidad = Number(plan.valorMensualidad);
      const conDescuento = dinero(Math.round(valorMensualidad * (1 - Number(def.descuento))));

      for (const m of mesesFacturables(def.fechaIngreso, fin)) {
        await crearPago(afiliadoId, factura, [
          { concepto: 'mensualidad', fechaCobertura: aCobertura(m), monto: conDescuento },
        ], 'verificado');
      }

      // El afiliado "mora" además tiene un pago PENDIENTE de sus 3 meses adeudados
      // (multimes: sirve para probar verificación y el cálculo de estado en la Fase 3).
      if (def.cobertura === 'mora') {
        const adeudados = mesesFacturables(sumarMeses(fin, 1), hoy);
        if (adeudados.length > 0) {
          await crearPago(
            afiliadoId,
            factura,
            adeudados.map((m) => ({ concepto: 'mensualidad' as const, fechaCobertura: aCobertura(m), monto: conDescuento })),
            'pendiente',
            'Pago por meses adeudados (ejemplo para probar verificación)',
          );
        }
      }
    }
  });

  console.log('Seed aplicado (transacción única):');
  console.log(`  planes        : ${planesRows.length}`);
  console.log(`  categorías    : ${categoriasCreadas}`);
  console.log(`  afiliados     : ${afiliadosInsertados.length}`);
  console.log(`  pagos         : ${pagosCreados}`);
  console.log('  usuarios      : admin@truchas.test, operador@truchas.test (Fase 2: dev-login)');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed falló:', err);
    process.exit(1);
  });

