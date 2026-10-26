/**
 * Unidad: menú lateral — filtrado por rol e ítem activo
 * (Spec del cliente §3: Administración solo para admin; la seguridad es de
 * la API, esto solo evita mostrar lo que no se puede usar).
 */
import { describe, expect, it } from 'vitest';

import { entradasMenu, entradasParaRol, esEntradaActiva } from '../../src/components/layout/entradas-menu';

describe('entradasParaRol', () => {
  it('admin ve las cuatro entradas en orden', () => {
    expect(entradasParaRol('admin').map((e) => e.ruta)).toEqual([
      '/',
      '/afiliados',
      '/pagos',
      '/admin',
    ]);
  });

  it('operador no ve Administración', () => {
    const rutas = entradasParaRol('operador').map((e) => e.ruta);
    expect(rutas).toEqual(['/', '/afiliados', '/pagos']);
    expect(rutas).not.toContain('/admin');
  });

  it('rol desconocido o ausente nunca ve entradas solo-admin', () => {
    for (const rol of [undefined, '', 'invitado', 'ADMIN', 'superadmin']) {
      expect(entradasParaRol(rol).some((e) => e.soloAdmin)).toBe(false);
    }
  });

  it('las entradas públicas siempre están', () => {
    const publicas = entradasMenu.filter((e) => !e.soloAdmin);
    for (const rol of [undefined, 'admin', 'operador']) {
      const rutas = entradasParaRol(rol).map((e) => e.ruta);
      for (const publica of publicas) expect(rutas).toContain(publica.ruta);
    }
  });
});

describe('esEntradaActiva', () => {
  const [dashboard, afiliados, pagos] = entradasMenu;

  it('Dashboard solo está activo en la raíz exacta', () => {
    if (!dashboard || !afiliados || !pagos) throw new Error('faltan entradas');
    expect(esEntradaActiva(dashboard, '/')).toBe(true);
    expect(esEntradaActiva(dashboard, '/afiliados')).toBe(false);
    expect(esEntradaActiva(dashboard, '/otra')).toBe(false);
  });

  it('una ruta activa por prefijo, con / o fin de cadena (subrutas)', () => {
    if (!afiliados || !pagos) throw new Error('faltan entradas');
    expect(esEntradaActiva(afiliados, '/afiliados')).toBe(true);
    expect(esEntradaActiva(afiliados, '/afiliados/123')).toBe(true);
    expect(esEntradaActiva(pagos, '/pagos/nuevo')).toBe(true);
  });

  it('prefijos que comparten texto NO activan la entrada', () => {
    if (!afiliados) throw new Error('faltan entradas');
    expect(esEntradaActiva(afiliados, '/afiliados-viejo')).toBe(false);
    expect(esEntradaActiva(afiliados, '/afiliadosx')).toBe(false);
  });
});
