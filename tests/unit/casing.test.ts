/**
 * Pruebas unitarias de la conversión wire ↔ interno (src/shared/casing.ts).
 *
 * El contrato de la API es snake_case en paridad con las columnas de la base,
 * mientras los services/repositories trabajan en camelCase como Drizzle.
 * serializar() cierra cada respuesta: convierte y la valida contra el esquema
 * declarado en la ruta (el esquema ES el contrato OpenAPI).
 */
import { describe, expect, it } from 'vitest';
import { z } from '@hono/zod-openapi';

import { aCamel, aSnake, serializar } from '../../src/shared/casing';

describe('aCamel', () => {
  it('convierte claves snake a camel, incluidas anidadas y dentro de arreglos', () => {
    const entrada = {
      numero_documento: '1234567890',
      fecha_cobertura: '2026-03-01',
      factura: { tipo_documento: 'NIT', nombre_completo: null },
      lineas: [{ afiliado_id: 'abc', fecha_cobertura: '2026-03-01' }],
      id: 'x',
      nombre: 'Truchas',
    };
    expect(aCamel(entrada)).toEqual({
      numeroDocumento: '1234567890',
      fechaCobertura: '2026-03-01',
      factura: { tipoDocumento: 'NIT', nombreCompleto: null },
      lineas: [{ afiliadoId: 'abc', fechaCobertura: '2026-03-01' }],
      id: 'x',
      nombre: 'Truchas',
    });
  });

  it('conserva primitivos, null y Date sin tocarlos', () => {
    const fecha = new Date('2026-10-03T12:00:00.000Z');
    expect(aCamel({ revisado_en: fecha, monto: '10.00', activo: true, motivo: null })).toEqual({
      revisadoEn: fecha,
      monto: '10.00',
      activo: true,
      motivo: null,
    });
  });

  it('no asume snake en claves que ya son camel (idempotente en claves simples)', () => {
    expect(aCamel({ id: 1, limit: 10 })).toEqual({ id: 1, limit: 10 });
  });
});

describe('aSnake', () => {
  it('convierte camel a snake y Date a ISO-8601 (el wire no serializa Date solo en tipo)', () => {
    expect(
      aSnake({
        numeroDocumento: '123',
        createdAt: new Date('2026-10-03T12:00:00.000Z'),
        lineas: [{ afiliadoId: 'abc', creadoEn: new Date('2026-01-01T05:00:00.000Z') }],
      }),
    ).toEqual({
      numero_documento: '123',
      created_at: '2026-10-03T12:00:00.000Z',
      lineas: [{ afiliado_id: 'abc', creado_en: '2026-01-01T05:00:00.000Z' }],
    });
  });
});

describe('serializar', () => {
  const esquema = z.object({
    id: z.uuid(),
    estado: z.enum(['pendiente', 'verificado']),
    created_at: z.iso.datetime(),
  });

  it('recorta las claves de más que no están en el contrato', () => {
    const id = '3f6a1a3e-0000-4000-8000-000000000001';
    const salida = serializar(esquema, {
      id,
      estado: 'pendiente',
      created_at: new Date('2026-10-03T12:00:00.000Z'),
      organizacion_id: 'interno-no-wire',
      revisadoPor: 'tampoco',
    });
    expect(salida).toEqual({
      id,
      estado: 'pendiente',
      created_at: '2026-10-03T12:00:00.000Z',
    });
    expect(salida).not.toHaveProperty('organizacion_id');
  });

  it('lanza si la fila no cumple el contrato (enums estrechos, formatos)', () => {
    expect(() =>
      serializar(esquema, { id: 'no-uuid', estado: 'rechazado', created_at: 'ayer' }),
    ).toThrow();
  });

  it('convierte fechas a ISO antes de validar el esquema', () => {
    const salida = serializar(
      esquema,
      {
        id: '3f6a1a3e-0000-4000-8000-000000000002',
        estado: 'verificado',
        created_at: new Date('2026-10-03T12:00:00.000Z'),
      },
    );
    expect(salida.created_at).toBe('2026-10-03T12:00:00.000Z');
  });
});
