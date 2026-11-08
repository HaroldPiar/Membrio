/**
 * Unidad: huella del hash de contraseña para el claim `ph` del JWT.
 *
 * La huella es la invalidación fuerte de sesiones: a diferencia de `iat`
 * (segundos), cambia en el mismo segundo en que se cambia/restablece la
 * contraseña. Debe ser determinista, distinta por hash y no revelar el hash.
 */
import { describe, expect, it } from 'vitest';

import { hashPassword, huellaPassword } from '../../src/server/auth/password';

describe('huellaPassword', () => {
  it('es determinista y de 16 hex', () => {
    const hash = hashPassword('clave-de-prueba-1234');
    const primera = huellaPassword(hash);
    expect(primera).toMatch(/^[0-9a-f]{16}$/);
    expect(huellaPassword(hash)).toBe(primera);
  });

  it('cambia cuando cambia el hash', () => {
    const uno = huellaPassword(hashPassword('clave-de-prueba-1234'));
    const otro = huellaPassword(hashPassword('otra-clave-distinta-1234'));
    expect(uno).not.toBe(otro);
  });

  it('sin hash (dev/seed) es estable y distinta de cualquier hash real', () => {
    expect(huellaPassword(null)).toBe(huellaPassword(undefined));
    expect(huellaPassword(null)).toMatch(/^[0-9a-f]{16}$/);
    expect(huellaPassword(null)).not.toBe(huellaPassword(hashPassword('clave-de-prueba-1234')));
  });

  it('no expone el hash scrypt', () => {
    const hash = hashPassword('clave-de-prueba-1234');
    expect(huellaPassword(hash)).not.toContain('scrypt');
    expect(huellaPassword(hash)).not.toBe(hash);
  });
});
