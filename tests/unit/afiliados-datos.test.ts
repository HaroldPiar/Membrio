/**
 * Unidad: capa pura de afiliados (Fase 3, Spec del cliente §4.3).
 * Enfocado en: filtros → query, mensajes de formulario en español, validación
 * de documento compartida y normalización de opcionales ('' → null).
 */
import { describe, expect, it } from 'vitest';

import {
  ETIQUETAS_DOCUMENTO,
  FILTROS_INICIALES,
  acudienteConContenido,
  acudienteParaEnviar,
  alternarOrden,
  conFiltro,
  esquemaFormularioAfiliado,
  filtrosAUrl,
  filtrosDeUrl,
  fraccionAPorcentaje,
  parametrosListado,
  valoresAlta,
  valoresEdicion,
  type Afiliado,
} from '../../src/lib/afiliados-datos';
import { TIPOS_DOCUMENTO } from '../../src/shared/documento';

const UUID_PLAN = '11111111-1111-4111-8111-111111111111';
const UUID_CATEGORIA = '22222222-2222-4222-8222-222222222222';

function valoresValidos() {
  return {
    tipo_documento: 'CC',
    numero_documento: '1002345678',
    nombre: 'Sofía Ramírez',
    fecha_nacimiento: '2014-03-15',
    celular: '3001234567',
    correo: 'familia@ejemplo.com',
    tipo_sangre: 'O+',
    plan_id: UUID_PLAN,
    categoria_id: UUID_CATEGORIA,
    fecha_ingreso: '2026-01-15',
    descuento: '0',
  };
}

const mensajesDe = (ruta: (string | number)[], fallos: { path: PropertyKey[]; message: string }[]) =>
  fallos.filter((f) => f.path.join('.') === ruta.join('.')).map((f) => f.message);

describe('parametrosListado', () => {
  it('omite los filtros vacíos y siempre manda limit', () => {
    expect(parametrosListado(FILTROS_INICIALES)).toEqual({ limit: 20 });
  });

  it('incluye solo lo filtrado, con q recortado y cursor cuando existe', () => {
    const parametros = parametrosListado(
      {
        q: '  ramirez  ',
        activo: false,
        categoria: UUID_CATEGORIA,
        plan: '',
        estado_pago: 'en_mora',
        orden: 'nombre',
        direccion: 'asc',
      },
      'cursor123',
    );
    expect(parametros).toEqual({
      limit: 20,
      q: 'ramirez',
      activo: false,
      categoria: UUID_CATEGORIA,
      estado_pago: 'en_mora',
      cursor: 'cursor123',
    });
    expect(parametros).not.toHaveProperty('plan');
  });

  it('omite el orden por defecto y manda solo el orden activo', () => {
    expect(parametrosListado({ ...FILTROS_INICIALES, orden: 'documento', direccion: 'desc' })).toEqual({
      limit: 20,
      orden: 'documento',
      direccion: 'desc',
    });
    expect(parametrosListado({ ...FILTROS_INICIALES, orden: 'documento' })).toEqual({
      limit: 20,
      orden: 'documento',
    });
  });
});

describe('alternarOrden (clic en encabezado)', () => {
  it('activa un campo nuevo en ASC y luego alterna ASC ⇄ DESC', () => {
    const porDocumento = alternarOrden(FILTROS_INICIALES, 'documento');
    expect(porDocumento.orden).toBe('documento');
    expect(porDocumento.direccion).toBe('asc');

    const desc = alternarOrden(porDocumento, 'documento');
    expect(desc.direccion).toBe('desc');

    const vuelveAsc = alternarOrden(desc, 'documento');
    expect(vuelveAsc.direccion).toBe('asc');
  });

  it('cambiar de campo vuelve a ASC y no toca los demás filtros', () => {
    const conQ = { ...FILTROS_INICIALES, q: 'pep', orden: 'documento' as const, direccion: 'desc' as const };
    const porNombre = alternarOrden(conQ, 'nombre');
    expect(porNombre.orden).toBe('nombre');
    expect(porNombre.direccion).toBe('asc');
    expect(porNombre.q).toBe('pep');
  });
});

describe('conFiltro (encabezado de columna → estado)', () => {
  it('convierte los strings del desplegable', () => {
    expect(conFiltro(FILTROS_INICIALES, 'activo', 'true').activo).toBe(true);
    expect(conFiltro(FILTROS_INICIALES, 'activo', 'false').activo).toBe(false);
    expect(conFiltro(FILTROS_INICIALES, 'activo', '').activo).toBeNull();
    expect(conFiltro(FILTROS_INICIALES, 'estado_pago', 'en_mora').estado_pago).toBe('en_mora');
    expect(conFiltro(FILTROS_INICIALES, 'estado_pago', '').estado_pago).toBeNull();
    expect(conFiltro(FILTROS_INICIALES, 'plan', UUID_PLAN).plan).toBe(UUID_PLAN);
    // No pisa los demás filtros.
    const conQ = { ...FILTROS_INICIALES, q: 'pep' };
    expect(conFiltro(conQ, 'categoria', UUID_CATEGORIA).q).toBe('pep');
  });
});

describe('filtros ↔ URL', () => {
  it('solo escribe en la URL lo que está activo', () => {
    expect(filtrosAUrl(FILTROS_INICIALES)).toBe('/afiliados');
    expect(filtrosAUrl({ ...FILTROS_INICIALES, estado_pago: 'en_mora', q: 'ana' })).toBe(
      '/afiliados?q=ana&estado=en_mora',
    );
  });

  it('lee lo que el dashboard enlaza y descarta lo inválido', () => {
    expect(filtrosDeUrl(new URLSearchParams('estado=en_mora'))).toEqual({
      estado_pago: 'en_mora',
      q: '',
      activo: null,
      orden: 'nombre',
      direccion: 'asc',
    });
    expect(filtrosDeUrl(new URLSearchParams('estado=otra_cosa')).estado_pago).toBeNull();
    expect(filtrosDeUrl(new URLSearchParams('activo=false')).activo).toBe(false);
    expect(filtrosDeUrl(new URLSearchParams('q= ana ')).q).toBe(' ana ');
    expect(filtrosDeUrl(new URLSearchParams('orden=documento&direccion=desc'))).toMatchObject({
      orden: 'documento',
      direccion: 'desc',
    });
    expect(filtrosDeUrl(new URLSearchParams('orden=raro&direccion=alto')).direccion).toBe('asc');
  });

  it('escribe el orden no por defecto en la URL', () => {
    expect(filtrosAUrl({ ...FILTROS_INICIALES, orden: 'documento', direccion: 'desc' })).toBe(
      '/afiliados?orden=documento&direccion=desc',
    );
  });
});

describe('etiquetas de documento', () => {
  it('cubre todos los tipos del schema compartido', () => {
    for (const tipo of TIPOS_DOCUMENTO) {
      expect(ETIQUETAS_DOCUMENTO[tipo]).toBeTruthy();
    }
  });
});

describe('esquemaFormularioAfiliado', () => {
  it('acepta un alta válida sin acudiente', () => {
    const resultado = esquemaFormularioAfiliado.safeParse(valoresValidos());
    expect(resultado.success).toBe(true);
    if (resultado.success) expect(resultado.data.acudiente).toBeUndefined();
  });

  it('los vacíos reciben mensaje de campo en español (el refinement es el último issue)', () => {
    const resultado = esquemaFormularioAfiliado.safeParse({
      ...valoresValidos(),
      nombre: '',
      plan_id: '',
      categoria_id: '',
      fecha_ingreso: '',
    });
    expect(resultado.success).toBe(false);
    if (resultado.success) return;
    const fallos = resultado.error.issues.map((i) => ({ path: [...i.path], message: i.message }));
    expect(mensajesDe(['nombre'], fallos).at(-1)).toBe('Requerido');
    expect(mensajesDe(['plan_id'], fallos).at(-1)).toBe('Selecciona un plan');
    expect(mensajesDe(['categoria_id'], fallos).at(-1)).toBe('Selecciona una categoría');
    expect(mensajesDe(['fecha_ingreso'], fallos).at(-1)).toBe('Requerido');
    // El locale es cubre los checks base: ningún mensaje en inglés.
    expect(fallos.some((f) => /expected|too small|invalid input/i.test(f.message))).toBe(false);
  });

  it('aplica la regla compartida del par documento (CC solo dígitos)', () => {
    const resultado = esquemaFormularioAfiliado.safeParse({
      ...valoresValidos(),
      numero_documento: 'ABC123',
    });
    expect(resultado.success).toBe(false);
    if (resultado.success) return;
    const fallos = resultado.error.issues.map((i) => ({ path: [...i.path], message: i.message }));
    expect(mensajesDe(['numero_documento'], fallos)).toContain('CC requiere solo dígitos');
  });

  it('el bloque de acudiente se valida con el esquema compartido solo si hay contenido', () => {
    const sinContenido = esquemaFormularioAfiliado.safeParse({
      ...valoresValidos(),
      acudiente: { numero_documento: '  ', nombre: '', celular: '', correo: '' },
    });
    expect(sinContenido.success).toBe(true);

    const incompleto = esquemaFormularioAfiliado.safeParse({
      ...valoresValidos(),
      acudiente: { numero_documento: '79123456', nombre: '' },
    });
    expect(incompleto.success).toBe(false);
    if (incompleto.success) return;
    const fallos = incompleto.error.issues.map((i) => ({ path: [...i.path], message: i.message }));
    expect(mensajesDe(['acudiente', 'nombre'], fallos).at(-1)).toBe('Requerido');
  });
});

describe('acudiente', () => {
  it('detecta contenido y normaliza para el wire (vacios → null, principal)', () => {
    expect(acudienteConContenido(undefined)).toBe(false);
    expect(acudienteConContenido({ nombre: '   ' })).toBe(false);
    expect(acudienteConContenido({ nombre: 'Carlos' })).toBe(true);

    const enviado = acudienteParaEnviar({
      numero_documento: ' ab12 ',
      nombre: '  Carlos Ramírez ',
      celular: '  ',
      correo: '',
    });
    expect(enviado.numero_documento).toBe('AB12');
    expect(enviado.celular).toBeNull();
    expect(enviado.correo).toBeNull();
    expect(enviado.es_principal).toBe(true);
  });
});

describe('fraccionAPorcentaje (enteros, sin float)', () => {
  it('convierte fracciones del schema a porcentaje exacto', () => {
    expect(fraccionAPorcentaje('0.1000')).toBe('10 %');
    expect(fraccionAPorcentaje('0.5')).toBe('50 %');
    expect(fraccionAPorcentaje('0.0001')).toBe('0.01 %');
    expect(fraccionAPorcentaje('0.1234')).toBe('12.34 %');
    expect(fraccionAPorcentaje('1.0000')).toBe('100 %');
    expect(fraccionAPorcentaje('0.9999')).toBe('99.99 %');
  });
});

describe('defaultValues del formulario', () => {
  it('el alta nace con valores mínimos usables', () => {
    const alta = valoresAlta();
    expect(alta.tipo_documento).toBe('CC');
    expect(alta.descuento).toBe('0');
    expect(alta.plan_id).toBe('');
  });

  it('la edición convierte los nullable vacíos a undefined (input sin valor)', () => {
    const afiliado: Afiliado = {
      id: '33333333-3333-4333-8333-333333333333',
      plan_id: UUID_PLAN,
      categoria_id: UUID_CATEGORIA,
      tipo_documento: 'TI',
      numero_documento: '1002345678',
      nombre: 'Ana Pérez',
      celular: '3001234567',
      correo: 'ana@ejemplo.com',
      eps_id: null,
      tipo_sangre: 'A+',
      fecha_nacimiento: '2014-03-15',
      genero: null,
      medio_captacion: null,
      direccion: null,
      descuento: '0.1000',
      fecha_ingreso: '2026-01-15',
      fecha_retiro: null,
      motivo_retiro: null,
      activo: true,
      fecha_consentimiento: null,
      url_documentos: null,
      created_at: '2026-01-15T10:00:00.000Z',
      updated_at: '2026-01-15T10:00:00.000Z',
      estado_pago: 'al_dia',
    };
    const valores = valoresEdicion(afiliado);
    expect(valores.eps_id).toBeUndefined();
    expect(valores.genero).toBeUndefined();
    expect(valores.fecha_consentimiento).toBeUndefined();
    expect(valores.descuento).toBe('0.1000');
    expect(valores.nombre).toBe('Ana Pérez');
    // Y el esquema de edición (mismo de alta) acepta esos valores tal cual.
    expect(esquemaFormularioAfiliado.safeParse(valores).success).toBe(true);
  });
});
