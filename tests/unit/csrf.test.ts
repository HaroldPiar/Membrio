/**
 * Unidad: defensa CSRF pura (spec del cliente §6).
 *
 * Casos: métodos no mutantes nunca se rechazan; con Sec-Fetch-Site solo
 * same-origin/none pasan; sin Sec-Fetch-Site se compara el host de Origin;
 * sin cabeceras de origen se permite (decisión anotada, clientes no navegador);
 * Bearer y peticiones sin sesión nunca entran en la regla.
 */
import { describe, expect, it } from 'vitest';

import {
  esMetodoMutante,
  origenPropio,
  rechazarCsrf,
  sitioSeguroSecFetchSite,
} from '../../src/server/middleware/csrf';

const HOST = 'localhost:4321';
const base = {
  metodo: 'POST',
  origenToken: 'cookie' as const,
  host: HOST,
  origin: undefined as string | undefined,
  secFetchSite: undefined as string | undefined,
};

describe('esMetodoMutante', () => {
  it('detecta POST/PATCH/PUT/DELETE en cualquier casing', () => {
    expect(esMetodoMutante('POST')).toBe(true);
    expect(esMetodoMutante('patch')).toBe(true);
    expect(esMetodoMutante('DELETE')).toBe(true);
    expect(esMetodoMutante('GET')).toBe(false);
    expect(esMetodoMutante('HEAD')).toBe(false);
    expect(esMetodoMutante('OPTIONS')).toBe(false);
  });
});

describe('sitioSeguroSecFetchSite', () => {
  it('solo same-origin y none son propios', () => {
    expect(sitioSeguroSecFetchSite('same-origin')).toBe(true);
    expect(sitioSeguroSecFetchSite('none')).toBe(true);
    expect(sitioSeguroSecFetchSite('same-site')).toBe(false);
    expect(sitioSeguroSecFetchSite('cross-site')).toBe(false);
  });
});

describe('origenPropio', () => {
  it('compara host con y sin puerto, ignorando mayúsculas', () => {
    expect(origenPropio('http://localhost:4321', 'localhost:4321')).toBe(true);
    expect(origenPropio('HTTP://LOCALHOST:4321', 'localhost:4321')).toBe(true);
    expect(origenPropio('https://club.ejemplo.com', 'club.ejemplo.com')).toBe(true);
  });

  it('rechaza host distinto, Origin null y valores ilegibles', () => {
    expect(origenPropio('https://evil.example.com', 'localhost:4321')).toBe(false);
    expect(origenPropio('null', 'localhost:4321')).toBe(false);
    expect(origenPropio('no-es-url', 'localhost:4321')).toBe(false);
    expect(origenPropio(undefined, 'localhost:4321')).toBe(false);
    expect(origenPropio('http://localhost:4321', undefined)).toBe(false);
    expect(origenPropio('ftp://localhost:4321', 'localhost:4321')).toBe(false);
  });
});

describe('rechazarCsrf', () => {
  it('no aplica a Bearer ni a peticiones sin sesión', () => {
    expect(rechazarCsrf({ ...base, origenToken: 'bearer', origin: 'https://evil.example.com' })).toBe(false);
    expect(rechazarCsrf({ ...base, origenToken: 'ninguno', origin: 'https://evil.example.com' })).toBe(false);
  });

  it('no aplica a métodos no mutantes aunque el origen sea ajeno', () => {
    expect(rechazarCsrf({ ...base, metodo: 'GET', origin: 'https://evil.example.com' })).toBe(false);
    expect(rechazarCsrf({ ...base, metodo: 'HEAD', secFetchSite: 'cross-site' })).toBe(false);
  });

  it('con Sec-Fetch-Site declara el origen exacto', () => {
    expect(rechazarCsrf({ ...base, metodo: 'POST', secFetchSite: 'same-origin' })).toBe(false);
    expect(rechazarCsrf({ ...base, metodo: 'POST', secFetchSite: 'none' })).toBe(false);
    expect(rechazarCsrf({ ...base, metodo: 'DELETE', secFetchSite: 'cross-site' })).toBe(true);
    expect(rechazarCsrf({ ...base, metodo: 'PATCH', secFetchSite: 'same-site' })).toBe(true);
  });

  it('con Origin compara hosts y gana Sec-Fetch-Site si está presente', () => {
    expect(rechazarCsrf({ ...base, metodo: 'POST', origin: 'http://localhost:4321' })).toBe(false);
    expect(rechazarCsrf({ ...base, metodo: 'POST', origin: 'https://evil.example.com' })).toBe(true);
    // Origin parece propio pero Sec-Fetch-Site dice cross-site: se rechaza.
    expect(
      rechazarCsrf({ ...base, metodo: 'POST', origin: 'http://localhost:4321', secFetchSite: 'cross-site' }),
    ).toBe(true);
  });

  it('sin cabeceras de origen permite (cliente no navegador: decisión anotada)', () => {
    expect(rechazarCsrf({ ...base, metodo: 'POST' })).toBe(false);
  });
});
