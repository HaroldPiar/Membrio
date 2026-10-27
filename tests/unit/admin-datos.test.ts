/**
 * Unidad: capa pura de administración (Fase 5, Spec del cliente §4.6).
 * Enfocado en: mensajes de formulario en español colocados DONDE los muestra
 * zodResolver (primer issue por campo — ver el encabezado de admin-datos),
 * límites del wire y etiquetas de rol.
 */
import { describe, expect, it } from 'vitest';

import {
  ETIQUETAS_ROL,
  categoriaVacia,
  esquemaCategoria,
  esquemaPlan,
  esquemaUsuario,
  planValores,
  planVacio,
  usuarioVacio,
} from '../../src/lib/admin-datos';
import { rolSchema } from '../../src/shared/usuarios';
import type { Plan } from '../../src/lib/consultas-afiliados';

type Fallo = { path: PropertyKey[]; message: string };

const fallos = (resultado: { success: boolean; error?: { issues: Fallo[] } }) =>
  resultado.success ? [] : (resultado.error?.issues ?? []);

const mensajesDe = (ruta: (string | number)[], issues: Fallo[]) =>
  issues.filter((f) => f.path.join('.') === ruta.join('.')).map((f) => f.message);

describe('esquemaUsuario', () => {
  it('acepta datos válidos y normaliza correo y nombre', () => {
    const resultado = esquemaUsuario.safeParse({
      correo: '  OPERADOR@Truchas.TEST ',
      nombre: '  Ana Pérez  ',
      rol: 'operador',
    });
    expect(resultado.success).toBe(true);
    expect(resultado.success && resultado.data).toEqual({
      correo: 'operador@truchas.test',
      nombre: 'Ana Pérez',
      rol: 'operador',
    });
  });

  it('con el formulario vacío deja UN mensaje amable por campo (el que se ve en pantalla)', () => {
    const issues = fallos(esquemaUsuario.safeParse(usuarioVacio()));
    // zodResolver muestra el PRIMER issue de cada campo: debe ser exactamente
    // este, sin issues base por detrás.
    expect(mensajesDe(['correo'], issues)).toEqual(['Requerido']);
    expect(mensajesDe(['nombre'], issues)).toEqual(['Requerido']);
    expect(mensajesDe(['rol'], issues)).toEqual(['Selecciona un rol']);
    expect(issues).toHaveLength(3);
  });

  it('valida el formato del correo con mensaje propio', () => {
    const issues = fallos(
      esquemaUsuario.safeParse({ correo: 'no-es-correo', nombre: 'Ana', rol: 'admin' }),
    );
    expect(mensajesDe(['correo'], issues)).toEqual(['Correo inválido']);
  });

  it('rechaza un rol desconocido con el mensaje de selección (refine antes del pipe)', () => {
    const issues = fallos(
      esquemaUsuario.safeParse({ correo: 'a@b.co', nombre: 'Ana', rol: 'superuser' }),
    );
    expect(mensajesDe(['rol'], issues)).toEqual(['Selecciona un rol']);
  });

  it('limita el nombre a 120 caracteres como el wire', () => {
    const issues = fallos(
      esquemaUsuario.safeParse({ correo: 'a@b.co', nombre: 'x'.repeat(121), rol: 'admin' }),
    );
    expect(mensajesDe(['nombre'], issues)).toEqual(['Máximo 120 caracteres']);
  });
});

describe('ETIQUETAS_ROL', () => {
  it('cubre exactamente las opciones del enum del wire', () => {
    expect(Object.keys(ETIQUETAS_ROL).sort()).toEqual([...rolSchema.options].sort());
    expect(ETIQUETAS_ROL.admin).toBe('Administrador');
    expect(ETIQUETAS_ROL.operador).toBe('Operador');
  });
});

describe('esquemaPlan', () => {
  it('con el formulario vacío los tres campos piden Requerido', () => {
    const issues = fallos(esquemaPlan.safeParse(planVacio()));
    expect(mensajesDe(['nombre'], issues)).toEqual(['Requerido']);
    expect(mensajesDe(['valor_mensualidad'], issues)).toEqual(['Requerido']);
    expect(mensajesDe(['valor_matricula'], issues)).toEqual(['Requerido']);
    expect(issues).toHaveLength(3);
  });

  it('valida los montos con el formato de dineroSchema', () => {
    const issues = fallos(
      esquemaPlan.safeParse({ nombre: 'Alto', valor_mensualidad: 'abc', valor_matricula: '1.999' }),
    );
    expect(mensajesDe(['valor_mensualidad'], issues)[0]).toContain('Monto inválido');
    expect(mensajesDe(['valor_matricula'], issues)[0]).toContain('Monto inválido');
  });

  it('acepta montos válidos y los recorta', () => {
    const resultado = esquemaPlan.safeParse({
      nombre: ' Alto ',
      valor_mensualidad: ' 74000.00 ',
      valor_matricula: '80000',
    });
    expect(resultado.success && resultado.data).toEqual({
      nombre: 'Alto',
      valor_mensualidad: '74000.00',
      valor_matricula: '80000',
    });
  });

  it('planValores precarga los valores del plan para editar', () => {
    const plan = {
      id: '33333333-3333-4333-8333-333333333333',
      nombre: 'Básico',
      valor_mensualidad: '74000.00',
      valor_matricula: '80000.00',
      activo: true,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    } as Plan;
    expect(planValores(plan)).toEqual({
      nombre: 'Básico',
      valor_mensualidad: '74000.00',
      valor_matricula: '80000.00',
    });
  });
});

describe('esquemaCategoria', () => {
  it('con el formulario vacío pide Requerido', () => {
    const issues = fallos(esquemaCategoria.safeParse(categoriaVacia()));
    expect(mensajesDe(['nombre'], issues)).toEqual(['Requerido']);
    expect(issues).toHaveLength(1);
  });

  it('limita el nombre a 120 caracteres', () => {
    const issues = fallos(esquemaCategoria.safeParse({ nombre: 'x'.repeat(121) }));
    expect(mensajesDe(['nombre'], issues)).toEqual(['Máximo 120 caracteres']);
  });

  it('acepta y recorta un nombre válido', () => {
    const resultado = esquemaCategoria.safeParse({ nombre: '  Sub-10 Mariposa  ' });
    expect(resultado.success && resultado.data).toEqual({ nombre: 'Sub-10 Mariposa' });
  });
});
