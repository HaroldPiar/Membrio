/**
 * Formateo de fechas para MOSTRAR (Fase 3, panel de detalle de afiliados).
 * Las fechas del wire son 'YYYY-MM-DD' (calendario) o ISO con hora (instante):
 * se tratan distinto a propósito para que la zona de negocio no corra las
 * fechas puras al día anterior.
 */
import { describe, expect, it } from 'vitest';

import { formatearFecha, formatearInstante } from '../../src/lib/formato';

describe('formatearFecha (calendario)', () => {
  it('muestra la fecha en formato colombiano (dd/mm/aaaa)', () => {
    expect(formatearFecha('2026-10-25')).toBe('25/10/2026');
    expect(formatearFecha('2026-01-01')).toBe('1/01/2026');
  });

  it('una fecha inválida no rompe', () => {
    expect(formatearFecha('no-es-fecha')).toBe('—');
  });
});

describe('formatearInstante (zona America/Bogota)', () => {
  it('convierte el instante UTC a la zona de negocio', () => {
    // 2026-10-25T10:30Z = 5:30 a. m. en Bogotá (UTC-5).
    expect(formatearInstante('2026-10-25T10:30:00.000Z')).toBe('25/10/2026, 5:30 a. m.');
    // Medianoche UTC +2h ya es de noche del día anterior en Bogotá.
    expect(formatearInstante('2026-10-26T02:00:00.000Z')).toBe('25/10/2026, 9:00 p. m.');
  });

  it('un instante inválido no rompe', () => {
    expect(formatearInstante('basura')).toBe('—');
  });
});
