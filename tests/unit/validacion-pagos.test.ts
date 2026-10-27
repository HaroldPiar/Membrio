/**
 * Pruebas unitarias de la validación de pagos (specplan Fase 3: "validación de
 * pagos (suma, duplicados, día 1)"). Son reglas de forma del esquema Zod de
 * alta — viven en src/shared/pagos.ts y corren en la capa routes sin tocar base.
 *
 * La pertenencia al tenant y los duplicados contra la base son del service y
 * se cubren en tests/integracion.
 */
import { describe, expect, it } from 'vitest';

import { lineasAnterioresAlIngreso, pagoCreacionSchema } from '../../src/shared/pagos';
import { retiroSchema } from '../../src/shared/afiliados';

const AFILIADO_A = '3f6a1a3e-1111-4111-8111-000000000001';
const AFILIADO_B = '3f6a1a3e-2222-4222-8222-000000000002';

/** Pago de dos mensualidades (feb + mar 2026) con el total correcto. */
function pagoValido() {
  return {
    monto_total: '148000.00',
    factura_tipo_documento: 'CC',
    factura_documento: '1234567890',
    factura_nombre: 'Acme S.A.S.',
    lineas: [
      { afiliado_id: AFILIADO_A, concepto: 'mensualidad', fecha_cobertura: '2026-02-01', monto: '74000.00' },
      { afiliado_id: AFILIADO_A, concepto: 'mensualidad', fecha_cobertura: '2026-03-01', monto: '74000.00' },
    ],
  };
}

function fallos(datos: unknown): string[] {
  const r = pagoCreacionSchema.safeParse(datos);
  return r.success ? [] : r.error.issues.map((i) => i.message);
}

describe('pagoCreacionSchema — casos válidos', () => {
  it('acepta dos mensualidades con monto_total igual a la suma', () => {
    expect(pagoCreacionSchema.safeParse(pagoValido()).success).toBe(true);
  });

  it('acepta matrícula con fecha_cobertura = 1 de enero del año', () => {
    const pago = {
      monto_total: '80000.00',
      factura_tipo_documento: 'CC',
      factura_documento: '1234567890',
      factura_nombre: 'Acme S.A.S.',
      lineas: [
        { afiliado_id: AFILIADO_B, concepto: 'matricula', fecha_cobertura: '2026-01-01', monto: '80000.00' },
      ],
    };
    expect(pagoCreacionSchema.safeParse(pago).success).toBe(true);
  });

  it('acepta NIT con guion en la facturación (el único tipo que lo permite)', () => {
    const pago = { ...pagoValido(), factura_tipo_documento: 'NIT', factura_documento: '900123456-1' };
    expect(pagoCreacionSchema.safeParse(pago).success).toBe(true);
  });

  it('compara montos en centavos exactos (decimales sin error de flotante)', () => {
    const pago = {
      monto_total: '30.75',
      factura_tipo_documento: 'CC',
      factura_documento: '1234567890',
      factura_nombre: 'Acme',
      lineas: [
        { afiliado_id: AFILIADO_A, concepto: 'mensualidad', fecha_cobertura: '2026-02-01', monto: '10.50' },
        { afiliado_id: AFILIADO_B, concepto: 'mensualidad', fecha_cobertura: '2026-02-01', monto: '20.25' },
      ],
    };
    expect(pagoCreacionSchema.safeParse(pago).success).toBe(true);
    expect(fallos({ ...pago, monto_total: '30.76' }).join(' ')).toContain('suma de las líneas');
  });
});

describe('pagoCreacionSchema — rechazos', () => {
  it('fecha_cobertura que no es día 1 se rechaza', () => {
    const pago = pagoValido();
    pago.lineas[0]!.fecha_cobertura = '2026-02-15';
    expect(fallos(pago).join(' ')).toContain('día 1');
  });

  it('matrícula fuera del 1 de enero se rechaza', () => {
    const pago = {
      monto_total: '80000.00',
      factura_tipo_documento: 'CC',
      factura_documento: '1234567890',
      factura_nombre: 'Acme',
      lineas: [
        { afiliado_id: AFILIADO_A, concepto: 'matricula', fecha_cobertura: '2026-02-01', monto: '80000.00' },
      ],
    };
    expect(fallos(pago).join(' ')).toContain('1 de enero');
  });

  it('mensualidad de enero se rechaza (enero lo cubre la matrícula)', () => {
    const pago = {
      monto_total: '74000.00',
      factura_tipo_documento: 'CC',
      factura_documento: '1234567890',
      factura_nombre: 'Acme',
      lineas: [
        { afiliado_id: AFILIADO_A, concepto: 'mensualidad', fecha_cobertura: '2026-01-01', monto: '74000.00' },
      ],
    };
    expect(fallos(pago).join(' ')).toContain('enero lo cubre la matrícula');
  });

  it('líneas duplicadas (mismo afiliado, concepto y fecha) se rechazan', () => {
    const pago = pagoValido();
    pago.lineas[1]!.fecha_cobertura = '2026-02-01'; // idéntica a la primera
    expect(fallos(pago).join(' ')).toContain('duplicada');
  });

  it('monto_total distinto de la suma se rechaza con la suma real', () => {
    const pago = pagoValido();
    pago.monto_total = '148000.01';
    expect(fallos(pago).join(' ')).toContain('suma real: 148000.00');
  });

  it('montos no pueden ser number ni tener más de 2 decimales', () => {
    const pago = pagoValido();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- la API jamás debe aceptar number (spec §6)
    (pago.lineas[0] as any).monto = 74000;
    expect(fallos(pago).join(' ')).toContain('expected string');
    (pago.lineas[0] as any).monto = '74000.999';
    expect(fallos(pago).join(' ')).toContain('Monto inválido');
  });

  it('documento CC con letras o guion se rechaza (solo dígitos, spec §7)', () => {
    const pago = { ...pagoValido(), factura_documento: '900123456-1' };
    expect(fallos(pago).join(' ')).toContain('CC requiere solo dígitos');
  });

  it('un pago sin líneas se rechaza', () => {
    const pago = { ...pagoValido(), lineas: [] };
    expect(fallos(pago).join(' ')).toContain('al menos una línea');
  });
});

describe('lineasAnterioresAlIngreso (nada previo a la inscripción)', () => {
  const ingresos = new Map([
    ['harold', '2025-10-26'],
    ['sofia', '2026-01-15'],
  ]);

  it('rechaza coberturas anteriores al mes de ingreso (mes comparado como clave)', () => {
    const anteriores = lineasAnterioresAlIngreso(
      [
        { afiliado_id: 'harold', fecha_cobertura: '2025-08-01' }, // ← el bug reportado
        { afiliado_id: 'harold', fecha_cobertura: '2025-10-01' }, // mes de ingreso: válida
        { afiliado_id: 'sofia', fecha_cobertura: '2026-01-01' }, // ene de su ingreso: válida
      ],
      ingresos,
    );
    expect(anteriores).toEqual([
      { afiliado_id: 'harold', fecha_cobertura: '2025-08-01', fecha_ingreso: '2025-10-26' },
    ]);
  });

  it('la matrícula sigue la misma regla y un afiliado sin fecha se ignora', () => {
    const anteriores = lineasAnterioresAlIngreso(
      [
        { afiliado_id: 'harold', fecha_cobertura: '2025-01-01' },
        { afiliado_id: 'desconocido', fecha_cobertura: '2020-01-01' },
      ],
      ingresos,
    );
    expect(anteriores).toHaveLength(1);
    expect(anteriores[0]!.fecha_ingreso).toBe('2025-10-26');
  });
});

describe('retiroSchema (POST /afiliados/:id/retiro)', () => {
  it('acepta el cuerpo vacío (fecha por defecto hoy, motivo opcional)', () => {
    expect(retiroSchema.safeParse({}).success).toBe(true);
  });

  it('acepta fecha y motivo válidos', () => {
    expect(
      retiroSchema.safeParse({ fecha_retiro: '2026-10-24', motivo_retiro: 'Cambio de sede' }).success,
    ).toBe(true);
  });

  it('rechaza una fecha que no existe ni tiene formato de fecha', () => {
    expect(retiroSchema.safeParse({ fecha_retiro: '2026-13-24' }).success).toBe(false);
    expect(retiroSchema.safeParse({ fecha_retiro: '24/10/2026' }).success).toBe(false);
  });

  it('rechaza motivo vacío o demasiado largo', () => {
    expect(retiroSchema.safeParse({ motivo_retiro: '   ' }).success).toBe(false);
    expect(retiroSchema.safeParse({ motivo_retiro: 'x'.repeat(501) }).success).toBe(false);
  });
});
