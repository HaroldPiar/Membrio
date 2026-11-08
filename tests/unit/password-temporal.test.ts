/**
 * Unidad: contraseña temporal generada por el backend (task de usuarios).
 *
 * Reglas: 16 caracteres, alfabeto sin caracteres ambiguos (sin 0/O, 1/l/I),
 * cumple la política 12–128 y cada llamada es aleatoria.
 */
import { describe, expect, it } from 'vitest';

import {
  esContrasenaValida,
  generarContrasenaTemporal,
} from '../../src/server/auth/password';

const ALFABETO_PERMITIDO = /^[a-hj-km-np-zA-HJ-KM-NP-Z2-9]+$/;

describe('generarContrasenaTemporal', () => {
  it('genera 16 caracteres de un alfabeto sin ambiguos', () => {
    for (let i = 0; i < 200; i += 1) {
      const temporal = generarContrasenaTemporal();
      expect(temporal).toHaveLength(16);
      expect(ALFABETO_PERMITIDO.test(temporal)).toBe(true);
      expect(temporal).not.toMatch(/[0O1lI]/);
    }
  });

  it('cumple la política de contraseña 12–128', () => {
    expect(esContrasenaValida(generarContrasenaTemporal())).toBe(true);
  });

  it('no repite el mismo valor en llamadas consecutivas (aleatoriedad)', () => {
    const generadas = new Set(Array.from({ length: 50 }, () => generarContrasenaTemporal()));
    expect(generadas.size).toBeGreaterThan(45);
  });
});
