/**
 * Pruebas unitarias del estado de pago (spec §13: "reglas de negocio puras",
 * y §13: "ningún cambio en cálculo de pagos o aislamiento entra sin pruebas").
 *
 * Fecha fija en cada caso: las reglas dependen del día en America/Bogota.
 */
import { describe, expect, it } from 'vitest';

import { calcularEstadoPago, claveMes, hoyEnZona } from '../../src/server/services/estado-pago';

const HOY_EFECTIVO = new Date('2026-10-03T12:00:00Z'); // 2026-10-03 en Bogotá (UTC-5)

/** Set de meses pagados a partir de rangos compactos: rango(2, 9) = feb–sep. */
function rango(anio: number, desde: number, hasta: number): Set<string> {
  const meses = new Set<string>();
  for (let m = desde; m <= hasta; m += 1) meses.add(claveMes(anio, m));
  return meses;
}

describe('hoyEnZona', () => {
  it('convierte el instante a la fecha de America/Bogota', () => {
    expect(hoyEnZona(new Date('2026-10-03T12:00:00Z'))).toBe('2026-10-03');
    expect(hoyEnZona(new Date('2026-10-04T02:00:00Z'))).toBe('2026-10-03'); // UTC-5
    expect(hoyEnZona(new Date('2026-01-01T03:00:00Z'))).toBe('2025-12-31');
  });
});

describe('calcularEstadoPago', () => {
  it('afiliado retirado (activo=false) no se evalúa → null', () => {
    const r = calcularEstadoPago(
      { fechaIngreso: '2026-02-01', activo: false, mesesPagados: rango(2026, 2, 10) },
      HOY_EFECTIVO,
    );
    expect(r).toBeNull();
  });

  it('al día: mes actual y anteriores cubiertos (pago adelantado no afecta)', () => {
    const pagados = rango(2026, 2, 10);
    pagados.add(claveMes(2026, 11));
    pagados.add(claveMes(2026, 12)); // pago adelantado de nov–dic
    const r = calcularEstadoPago(
      { fechaIngreso: '2026-02-01', activo: true, mesesPagados: pagados },
      HOY_EFECTIVO,
    );
    expect(r?.estado).toBe('al_dia');
    expect(r?.mesesAdeudados).toEqual([]);
  });

  it('por vencer: anteriores pagados, mes actual sin pagar y dentro de la ventana (día 3 → faltan 2)', () => {
    const r = calcularEstadoPago(
      { fechaIngreso: '2026-02-01', activo: true, mesesPagados: rango(2026, 2, 9) },
      HOY_EFECTIVO,
    );
    expect(r?.estado).toBe('por_vencer');
    expect(r?.diasParaLimite).toBe(2);
    expect(r?.mesesAdeudados).toEqual([]);
  });

  it('en mora: mes anterior sin pagar aunque el mes actual esté dentro de la ventana', () => {
    const pagados = rango(2026, 2, 8); // septiembre (9) sin pagar
    const r = calcularEstadoPago(
      { fechaIngreso: '2026-02-01', activo: true, mesesPagados: pagados },
      HOY_EFECTIVO,
    );
    expect(r?.estado).toBe('en_mora');
    expect(r?.mesesAdeudados).toEqual(['2026-09']);
  });

  it('en mora: mes actual sin pagar después del día límite (día 6)', () => {
    const hoy = new Date('2026-10-06T12:00:00Z');
    const r = calcularEstadoPago(
      { fechaIngreso: '2026-02-01', activo: true, mesesPagados: rango(2026, 2, 9) },
      hoy,
    );
    expect(r?.estado).toBe('en_mora');
    expect(r?.mesesAdeudados).toEqual(['2026-10']);
    expect(r?.diasParaLimite).toBeNull();
  });

  it('enero no es facturable: sin adeudos anteriores → al día en enero', () => {
    const hoy = new Date('2027-01-04T12:00:00Z');
    const r = calcularEstadoPago(
      { fechaIngreso: '2026-02-01', activo: true, mesesPagados: rango(2026, 2, 12) },
      hoy,
    );
    expect(r?.estado).toBe('al_dia');
  });

  it('enero: diciembre sin pagar sigue siendo mora (su plazo venció en diciembre)', () => {
    const hoy = new Date('2027-01-04T12:00:00Z');
    const pagados = rango(2026, 2, 11); // diciembre (12) sin pagar
    const r = calcularEstadoPago(
      { fechaIngreso: '2026-02-01', activo: true, mesesPagados: pagados },
      hoy,
    );
    expect(r?.estado).toBe('en_mora');
    expect(r?.mesesAdeudados).toEqual(['2026-12']);
  });

  it('ingresó después del día límite: su mes de ingreso no es exigible', () => {
    // Ingresó 2026-02-20 (el plazo de febrero era 5 de febrero).
    const rFebrero = calcularEstadoPago(
      { fechaIngreso: '2026-02-20', activo: true, mesesPagados: new Set() },
      new Date('2026-02-25T12:00:00Z'),
    );
    expect(rFebrero?.estado).toBe('al_dia'); // febrero salteado, aún dentro del mes

    // Marzo sin pagar y hoy 3 de marzo → por vencer (marzo sí es exigible luego).
    const rMarzo = calcularEstadoPago(
      { fechaIngreso: '2026-02-20', activo: true, mesesPagados: new Set() },
      new Date('2026-03-03T12:00:00Z'),
    );
    expect(rMarzo?.estado).toBe('por_vencer');

    // En abril, febrero sigue sin ser exigible pero marzo sí: mora por marzo.
    const rAbril = calcularEstadoPago(
      { fechaIngreso: '2026-02-20', activo: true, mesesPagados: new Set() },
      new Date('2026-04-10T12:00:00Z'),
    );
    expect(rAbril?.estado).toBe('en_mora');
    expect(rAbril?.mesesAdeudados).toEqual(['2026-03', '2026-04']);
  });

  it('ingresó el día 1: su mes de ingreso SÍ es exigible', () => {
    const r = calcularEstadoPago(
      { fechaIngreso: '2026-10-01', activo: true, mesesPagados: new Set() },
      new Date('2026-10-20T12:00:00Z'),
    );
    expect(r?.estado).toBe('en_mora');
    expect(r?.mesesAdeudados).toEqual(['2026-10']);
  });

  it('meses anteriores al ingreso no se exigen (empezó en agosto)', () => {
    const r = calcularEstadoPago(
      { fechaIngreso: '2026-08-15', activo: true, mesesPagados: new Set() },
      HOY_EFECTIVO,
    );
    // agosto post-deadline → salteado; septiembre exigible desde octubre.
    // Hoy 3/10 y dentro de la ventana de octubre: adeudado solo septiembre.
    expect(r?.estado).toBe('en_mora');
    expect(r?.mesesAdeudados).toEqual(['2026-09']);
  });

  it('la matrícula no cuenta como mensualidad (solo meses con pago verificado de mensualidad)', () => {
    // Solo pagó matrícula (enero): mesesPagados viene vacío porque el caller
    // filtra concepto='mensualidad' → enero no evalúa, feb–sep adeudados.
    const r = calcularEstadoPago(
      { fechaIngreso: '2026-02-01', activo: true, mesesPagados: new Set() },
      HOY_EFECTIVO,
    );
    expect(r?.estado).toBe('en_mora');
    expect(r?.mesesAdeudados.length).toBeGreaterThan(0);
    expect(r?.mesesAdeudados).not.toContain('2026-01');
  });
});
