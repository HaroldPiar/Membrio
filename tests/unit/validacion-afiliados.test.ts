/**
 * Pruebas unitarias de la validación de afiliados (QASpec, Unidad 1).
 * Son reglas de forma del esquema Zod del listado — viven en
 * src/shared/afiliados.ts y corren en la capa routes sin tocar base.
 *
 * El caso clave: `?activo=false` debe filtrar RETIRADOS. Con el previo
 * `z.coerce.boolean()`, Zod 4 hacía Boolean('false') === true y «Retirados»
 * devolvía activos (bug reportado en QA: Camila Herrera López CC 45123987).
 */
import { describe, expect, it } from 'vitest';

import { afiliadoFiltrosSchema, afiliadoCreacionSchema } from '../../src/shared/afiliados';
import { TIPOS_DOCUMENTO } from '../../src/shared/documento';

describe('afiliadoFiltrosSchema — activo', () => {
  const validar = (query: Record<string, unknown>) =>
    afiliadoFiltrosSchema.safeParse(query);

  it('"false" filtra retirados (regresión del bug de coerce)', () => {
    const r = validar({ activo: 'false' });
    expect(r.success).toBe(true);
    expect(r.success && r.data.activo).toBe(false);
  });

  it('"true" filtra activos', () => {
    const r = validar({ activo: 'true' });
    expect(r.success).toBe(true);
    expect(r.success && r.data.activo).toBe(true);
  });

  it('sin el parámetro no se filtra (ambos)', () => {
    const r = validar({});
    expect(r.success).toBe(true);
    expect(r.success && r.data.activo).toBeUndefined();
  });

  it('valores no reconocidos son 400, no "devolver todo"', () => {
    expect(validar({ activo: 'bogus' }).success).toBe(false);
    expect(validar({ activo: '' }).success).toBe(false);
    expect(validar({ activo: '1' }).success).toBe(false);
  });

  it('acepta booleanos ya tipados (uso interno)', () => {
    expect(validar({ activo: false }).success).toBe(true);
    expect(validar({ activo: true }).success).toBe(true);
  });

  it('los otros filtros del listado siguen intactos', () => {
    const r = validar({ q: ' ramirez ', orden: 'documento', direccion: 'desc', limit: '10' });
    expect(r.success).toBe(true);
    expect(r.success && r.data).toMatchObject({
      q: 'ramirez',
      orden: 'documento',
      direccion: 'desc',
      limit: 10,
    });
  });
});

describe('afiliadoFiltrosSchema — orden y paginación', () => {
  it('orden/direccion tienen defaults y rechazan valores raros', () => {
    const base = afiliadoFiltrosSchema.parse({});
    expect(base.orden).toBe('nombre');
    expect(base.direccion).toBe('asc');
    expect(afiliadoFiltrosSchema.safeParse({ orden: 'raro' }).success).toBe(false);
    expect(afiliadoFiltrosSchema.safeParse({ direccion: 'alto' }).success).toBe(false);
  });

  it('limit respeta el máximo de 100', () => {
    expect(afiliadoFiltrosSchema.safeParse({ limit: '101' }).success).toBe(false);
    expect(afiliadoFiltrosSchema.safeParse({ limit: '0' }).success).toBe(false);
  });
});

describe('afiliadoCreacionSchema — humo', () => {
  it('rechaza un documento CC no numérico (regla compartida intacta)', () => {
    const r = afiliadoCreacionSchema.safeParse({
      plan_id: '11111111-1111-4111-8111-111111111111',
      categoria_id: '22222222-2222-4222-8222-222222222222',
      tipo_documento: 'CC' as const,
      numero_documento: '12AB',
      nombre: 'Prueba',
      celular: '3000000000',
      fecha_nacimiento: '2014-03-15',
      fecha_ingreso: '2026-06-15',
      tipo_sangre: 'O+',
    });
    expect(r.success).toBe(false);
  });

  it('TIPOS_DOCUMENTO sigue exportando los tipos del wire', () => {
    expect(TIPOS_DOCUMENTO).toContain('CC');
    expect(TIPOS_DOCUMENTO).toContain('TI');
  });
});
