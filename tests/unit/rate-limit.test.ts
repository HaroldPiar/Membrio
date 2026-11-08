/**
 * Unidad: limitador de intentos fallidos parametrizable.
 *
 * Login producción: 5 fallos por (correo + IP). Task de usuarios: además un
 * limitador por correo con 10 fallos (sin IP). Se prueba la fábrica con
 * ambos límites, el reinicio por éxito y la ventana temporal.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  crearLimitadorIntentos,
  LIMITE_INTENTOS_FALLIDOS,
  LIMITE_INTENTOS_POR_CORREO_FALLIDOS,
  VENTANA_INTENTOS_MS,
} from '../../src/server/auth/rate-limit';

afterEach(() => {
  vi.useRealTimers();
});

describe('crearLimitadorIntentos', () => {
  it('el límite por defecto es 5 y el de correo es 10', () => {
    expect(LIMITE_INTENTOS_FALLIDOS).toBe(5);
    expect(LIMITE_INTENTOS_POR_CORREO_FALLIDOS).toBe(10);
  });

  it('bloquea al alcanzar el límite por defecto y se libera al reiniciar', () => {
    const limitador = crearLimitadorIntentos();
    for (let i = 0; i < LIMITE_INTENTOS_FALLIDOS; i += 1) {
      expect(limitador.puedeIntentar('a')).toBe(true);
      limitador.registrarFallo('a');
    }
    expect(limitador.puedeIntentar('a')).toBe(false);
    limitador.reiniciar('a');
    expect(limitador.puedeIntentar('a')).toBe(true);
  });

  it('respeta un límite personalizado (por correo: 10)', () => {
    const limitador = crearLimitadorIntentos({ limite: LIMITE_INTENTOS_POR_CORREO_FALLIDOS });
    for (let i = 0; i < LIMITE_INTENTOS_POR_CORREO_FALLIDOS; i += 1) {
      limitador.registrarFallo('correo');
    }
    expect(limitador.puedeIntentar('correo')).toBe(false);
    // Las claves son independientes entre sí.
    expect(limitador.puedeIntentar('otro')).toBe(true);
  });

  it('la ventana se reinicia al vencer', () => {
    vi.useFakeTimers();
    const limitador = crearLimitadorIntentos();
    limitador.registrarFallo('clave');
    expect(limitador.puedeIntentar('clave')).toBe(true);
    limitador.registrarFallo('clave');
    limitador.registrarFallo('clave');
    limitador.registrarFallo('clave');
    limitador.registrarFallo('clave');
    expect(limitador.puedeIntentar('clave')).toBe(false);
    vi.advanceTimersByTime(VENTANA_INTENTOS_MS + 1);
    expect(limitador.puedeIntentar('clave')).toBe(true);
  });
});
