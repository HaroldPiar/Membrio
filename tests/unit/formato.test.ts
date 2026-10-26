/**
 * Unidad: formateo de dinero desde strings (Spec del cliente §5: los montos
 * NUNCA se calculan en el cliente, solo se formatean con Intl 'es-CO' COP).
 */
import { describe, expect, it } from 'vitest';

import { esDecimal, formatearDinero } from '../../src/lib/formato';

const NBSP = '\u00a0';

describe('formatearDinero', () => {
  it('formatea los montos de la API (COP sin fraccionarios)', () => {
    expect(formatearDinero('150000.00')).toBe(`$${NBSP}150.000`);
    expect(formatearDinero('0')).toBe(`$${NBSP}0`);
    expect(formatearDinero('-15000.00')).toBe(`-$${NBSP}15.000`);
  });

  it('redondea centavos al peso más cercano (COP tiene 0 decimales)', () => {
    expect(formatearDinero('150000.50')).toBe(`$${NBSP}150.001`);
  });

  it('no pierde precisión en montos enormes (imposible con number)', () => {
    // Como number, 123456789012345678901.5 se redondearía a 1.2345678901234568e20.
    expect(formatearDinero('123456789012345678901.5')).toBe(`$${NBSP}123.456.789.012.345.678.902`);
    expect(formatearDinero('999999999.99')).toBe(`$${NBSP}1.000.000.000`);
  });

  it('lanza con entradas que no son decimales (fallar temprano, no mostrar mentira)', () => {
    expect(() => formatearDinero('abc')).toThrow();
    expect(() => formatearDinero('12.34.56')).toThrow();
  });
});

describe('esDecimal', () => {
  it('acepta el formato que produce la API', () => {
    expect(esDecimal('150000.00')).toBe(true);
    expect(esDecimal('-15000')).toBe(true);
    expect(esDecimal('0')).toBe(true);
  });

  it('rechaza lo que no es decimal', () => {
    expect(esDecimal('abc')).toBe(false);
    expect(esDecimal('12.34.56')).toBe(false);
    expect(esDecimal('1e5')).toBe(false);
    expect(esDecimal('')).toBe(false);
  });
});
