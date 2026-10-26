/**
 * Unidad: mapeo de errores de la API a mensajes de interfaz
 * (Spec del cliente §5: 401 redirige a login —el redirect vive en `procesar`,
 * aquí se prueba el mapeo—; 403 "no tienes permiso"; 404/409/422 el mensaje
 * de la API).
 */
import { describe, expect, it } from 'vitest';

import { ErrorApi, mapearErrorApi } from '../../src/lib/api';

const envolvente = (code: string, message: string, details: unknown[] = []) => ({
  error: { code, message, details },
});

describe('mapearErrorApi', () => {
  it('401 → sesión (el caller redirige a /login)', () => {
    const e = mapearErrorApi(401, envolvente('SESION_INVALIDA', 'Token inválido o expirado'));
    expect(e.tipo).toBe('sesion');
    expect(e.codigo).toBe(401);
    expect(e.message).toContain('sesión');
  });

  it('403 → permiso con el texto del spec', () => {
    const e = mapearErrorApi(403, envolvente('PERMISO_INSUFICIENTE', 'Requiere uno de estos roles: admin'));
    expect(e.tipo).toBe('permiso');
    expect(e.message).toBe('No tienes permiso para esta acción.');
  });

  it('404/409/422 muestran el mensaje de la API', () => {
    expect(mapearErrorApi(404, envolvente('NO_ENCONTRADO', 'Afiliado no encontrado')).message).toBe(
      'Afiliado no encontrado',
    );
    expect(mapearErrorApi(409, envolvente('DUPLICADO', 'El registro ya existe (duplicado)')).message).toBe(
      'El registro ya existe (duplicado)',
    );
    expect(mapearErrorApi(422, envolvente('REFERENCIA_INVALIDA', 'Referencia inválida')).message).toBe(
      'Referencia inválida',
    );
  });

  it('400 y 422 son de validación y conservan los details (para errores de campo)', () => {
    const detalles = [{ path: ['nombre'], message: 'Requerido' }];
    const e = mapearErrorApi(400, envolvente('VALIDACION', 'Datos inválidos', detalles));
    expect(e.tipo).toBe('validacion');
    expect(e.detalles).toEqual(detalles);
    expect(mapearErrorApi(422, envolvente('DATO_OBLIGATORIO', 'Falta un dato')).tipo).toBe('validacion');
  });

  it('500+ → servidor con aviso genérico (no se filtra el interno)', () => {
    const e = mapearErrorApi(500, { stack: 'secreto del servidor' });
    expect(e.tipo).toBe('servidor');
    expect(e.message).toBe('Error del servidor. Intenta de nuevo en un momento.');
    expect(e.message).not.toContain('secreto');
  });

  it('cuerpos ausentes o ilegibles no rompen el mapeo', () => {
    expect(mapearErrorApi(404, null).tipo).toBe('no_encontrado');
    expect(mapearErrorApi(404, undefined).tipo).toBe('no_encontrado');
    expect(mapearErrorApi(404, 'html raro').message).toBe('No se encontró lo solicitado.');
    expect(mapearErrorApi(418, {}).tipo).toBe('desconocido');
    expect(mapearErrorApi(418, {}).message).toBe('Error inesperado (HTTP 418).');
  });

  it('ErrorApi conserva tipo, código y detalles', () => {
    const e = new ErrorApi('conflicto', 409, 'ya existe', ['x']);
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe('ErrorApi');
    expect(e.tipo).toBe('conflicto');
    expect(e.codigo).toBe(409);
    expect(e.detalles).toEqual(['x']);
  });
});
