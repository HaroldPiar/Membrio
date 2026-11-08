/**
 * Unidad: destino del cliente tras iniciar sesión.
 *
 * Con la contraseña temporal pendiente, el cliente va DIRECTO a
 * /cambiar-password (la API bloquea todo lo demás con 403) y no pasa por el
 * dashboard. Sin el flag, al dashboard.
 */
import { describe, expect, it } from 'vitest';

import { destinoTrasLogin } from '../../src/lib/rutas-sesion';

describe('destinoTrasLogin', () => {
  it('con debe_cambiar_password va directo al cambio de contraseña', () => {
    expect(destinoTrasLogin({ debe_cambiar_password: true })).toBe('/cambiar-password');
  });

  it('sin el flag va al dashboard', () => {
    expect(destinoTrasLogin({ debe_cambiar_password: false })).toBe('/');
  });

  it('sin usuario (respuesta inesperada) no bloquea la entrada normal', () => {
    expect(destinoTrasLogin(undefined)).toBe('/');
    expect(destinoTrasLogin({})).toBe('/');
  });
});
