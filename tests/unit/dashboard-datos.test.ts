/**
 * Unidad: transformaciones del dashboard (Spec del cliente §4.2).
 * Enfocado en la regla de dinero (§5): nada se calcula con flotantes y los
 * montos que se muestran salen de los strings del wire.
 */
import { describe, expect, it } from 'vitest';

import {
  etiquetaMes,
  etiquetaMesChip,
  etiquetaMesLarga,
  porcionesEstados,
  porcentajes,
  serieRecaudo,
  topMorosos,
  type Deudor,
} from '../../src/lib/dashboard-datos';

describe('etiquetas de mes (es-CO)', () => {
  it('etiqueta corta, larga y chip', () => {
    expect(etiquetaMes('2026-09')).toBe('sept.');
    expect(etiquetaMesLarga('2026-09')).toBe('septiembre de 2026');
    expect(etiquetaMesChip('2026-09')).toBe('sept 2026');
    expect(etiquetaMesChip('2025-11')).toBe('nov 2025');
    // Cruce de año: la clave manda, no el año actual.
    expect(etiquetaMesLarga('2025-11')).toBe('noviembre de 2025');
  });
});

describe('serieRecaudo', () => {
  it('conserva el string del monto y deriva solo la magnitud de escala', () => {
    const serie = serieRecaudo([
      { mes: '2026-09', total: '588000.00' },
      { mes: '2026-10', total: '0.00' },
    ]);
    expect(serie).toHaveLength(2);
    const [primero, segundo] = serie;
    if (!primero || !segundo) throw new Error('serie vacía');
    expect(primero.total).toBe('588000.00'); // el monto NO se transforma
    expect(primero.etiqueta).toBe('sept.');
    expect(primero.magnitud).toBe(588000); // solo escala la barra
    expect(segundo.magnitud).toBe(0);
  });

  it('montos gigantes no pierden la forma string', () => {
    const [punto] = serieRecaudo([{ mes: '2026-01', total: '123456789012345678901.5' }]);
    if (!punto) throw new Error('serie vacía');
    expect(punto.total).toBe('123456789012345678901.5');
    expect(punto.magnitud).toBe(1.2345678901234568e20); // finita: solo escala
  });
});

describe('porcionesEstados / porcentajes', () => {
  const afiliados = { total: 8, activos: 6, retirados: 2, al_dia: 3, por_vencer: 0, en_mora: 3 };

  it('omite estados con cero para no ensuciar la dona', () => {
    const porciones = porcionesEstados(afiliados);
    expect(porciones.map((p) => p.estado)).toEqual(['al_dia', 'en_mora']);
  });

  it('porcentajes sobre conteos (no dinero) que suman 100', () => {
    const porciones = porcionesEstados(afiliados);
    const conPorcentaje = porcentajes(porciones);
    expect(conPorcentaje).toEqual([
      { estado: 'al_dia', cantidad: 3, porcentaje: 50 },
      { estado: 'en_mora', cantidad: 3, porcentaje: 50 },
    ]);
    expect(conPorcentaje.reduce((s, p) => s + p.porcentaje, 0)).toBe(100);
  });

  it('todo en cero no produce divisiones por cero', () => {
    const vacio = porcionesEstados({ ...afiliados, al_dia: 0, en_mora: 0 });
    expect(vacio).toEqual([]);
    expect(porcentajes(vacio)).toEqual([]);
  });
});

describe('topMorosos', () => {
  const deudor = (id: string, nombre: string, valor: string): Deudor => ({
    afiliado_id: id,
    nombre,
    plan_id: 'p',
    categoria_id: 'c',
    meses_adeudados: ['2026-09'],
    valor_adeudado: valor,
  });

  it('ordena de mayor a menor deuda en centavos exactos (no lexicográfico)', () => {
    const deudores = [
      deudor('a', 'Nueve mil', '9000.00'),
      deudor('b', 'Diez mil', '10000.00'),
      deudor('c', 'Un peso menos', '9999.99'),
    ];
    expect(topMorosos(deudores, 3).map((d) => d.nombre)).toEqual([
      'Diez mil',
      'Un peso menos',
      'Nueve mil',
    ]);
  });

  it('recorta a N sin mutar el array original', () => {
    const deudores = [deudor('a', 'A', '100.00'), deudor('b', 'B', '900.00')];
    const copia = [...deudores];
    const top = topMorosos(deudores, 1);
    expect(top).toHaveLength(1);
    expect(top[0]?.nombre).toBe('B');
    expect(deudores).toEqual(copia);
  });
});
