/**
 * Unidad: capa pura de pagos (Fase 4, Spec del cliente §4.4–4.5).
 * Enfocado en: filtros → query, líneas (día 1, matrícula enero), total con
 * decimal.js, sugerencia con descuento espejo del backend, facturación con
 * mensajes en español y validación del comprobante.
 */
import { describe, expect, it } from 'vitest';

import {
  ETIQUETAS_CONCEPTO,
  ETIQUETAS_DOCUMENTO_FACTURACION,
  ETIQUETAS_ESTADO_VERIFICACION,
  FILTROS_INICIALES_PAGOS,
  FILTROS_PENDIENTES,
  MESES_COBRABLES,
  conFiltroPagos,
  esDineroValido,
  esImagen,
  esMimeComprobante,
  esquemaFacturacion,
  facturacionDesdeAfiliado,
  facturacionVacia,
  aniosMatriculaDe,
  etiquetaMesAnio,
  lineasDesde,
  mesesCobrablesDe,
  nuevaSeleccion,
  parametrosPagos,
  sugerenciasDe,
  totalLineas,
  validarComprobante,
  type SeleccionAfiliado,
} from '../../src/lib/pagos-datos';
import type { Afiliado } from '../../src/lib/afiliados-datos';
import type { Plan } from '../../src/lib/consultas-afiliados';
import { TIPOS_DOCUMENTO, TIPOS_DOCUMENTO_FACTURACION } from '../../src/shared/documento';

const UUID_AFILIADO = '44444444-4444-4444-8444-444444444444';
const UUID_PLAN = '11111111-1111-4111-8111-111111111111';
const UUID_CATEGORIA = '22222222-2222-4222-8222-222222222222';

function afiliado(descuento = '0'): Afiliado {
  return {
    id: UUID_AFILIADO,
    plan_id: UUID_PLAN,
    categoria_id: UUID_CATEGORIA,
    tipo_documento: 'CC',
    numero_documento: '1002345678',
    nombre: 'Sofía Ramírez',
    celular: '3001234567',
    correo: 'familia@ejemplo.com',
    eps_id: null,
    tipo_sangre: 'O+',
    fecha_nacimiento: '2014-03-15',
    genero: null,
    medio_captacion: null,
    direccion: null,
    descuento,
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
}

function plan(mensualidad = '35000.00', matricula = '80000.00'): Plan {
  return {
    id: UUID_PLAN,
    nombre: 'Competición',
    valor_mensualidad: mensualidad,
    valor_matricula: matricula,
    activo: true,
    created_at: '2026-01-01T10:00:00.000Z',
    updated_at: '2026-01-01T10:00:00.000Z',
  };
}

function seleccion(descuento = '0', meses: string[] = [], matriculaAnio: number | null = null): SeleccionAfiliado {
  return { ...nuevaSeleccion(afiliado(descuento), plan()), meses, matriculaAnio };
}

/** Réplica del cálculo del backend (services/dashboard.ts) en centavos. */
function valorMensualCentavosBackend(valor: string, descuento: string): number {
  const [enteros, decimales = ''] = valor.split('.');
  const base = Number(enteros) * 100 + Number(decimales.padEnd(2, '0'));
  const diezmil = Math.round(Number(descuento) * 10000);
  return Math.round((base * (10000 - diezmil)) / 10000);
}

const mensajesDe = (ruta: (string | number)[], fallos: { path: PropertyKey[]; message: string }[]) =>
  fallos.filter((f) => f.path.join('.') === ruta.join('.')).map((f) => f.message);

describe('parametrosPagos (filtros → query)', () => {
  it('omite los filtros vacíos y siempre manda limit', () => {
    expect(parametrosPagos(FILTROS_INICIALES_PAGOS)).toEqual({ limit: 20 });
  });

  it('incluye solo lo filtrado, con cursor cuando existe', () => {
    const parametros = parametrosPagos(
      {
        ...FILTROS_INICIALES_PAGOS,
        estado: 'rechazado',
        desde: '2026-01-01',
        hasta: '2026-01-31',
      },
      'cursor123',
    );
    expect(parametros).toEqual({
      limit: 20,
      estado: 'rechazado',
      desde: '2026-01-01',
      hasta: '2026-01-31',
      cursor: 'cursor123',
    });
  });

  it('manda factura y revisado solo cuando tienen contenido', () => {
    expect(
      parametrosPagos({
        ...FILTROS_INICIALES_PAGOS,
        factura: '  ramirez  ',
        revisado_desde: '2026-03-01',
        revisado_hasta: '2026-03-31',
      }),
    ).toEqual({
      limit: 20,
      factura: 'ramirez',
      revisado_desde: '2026-03-01',
      revisado_hasta: '2026-03-31',
    });
    expect(parametrosPagos({ ...FILTROS_INICIALES_PAGOS, factura: '   ' })).toEqual({ limit: 20 });
  });

  it('la bandeja es el filtro estado=pendiente', () => {
    expect(parametrosPagos(FILTROS_PENDIENTES)).toEqual({ limit: 20, estado: 'pendiente' });
  });
});

describe('conFiltroPagos (controles → estado)', () => {
  it('convierte los strings y limpia con vacío', () => {
    expect(conFiltroPagos(FILTROS_INICIALES_PAGOS, 'estado', 'verificado').estado).toBe('verificado');
    expect(conFiltroPagos(FILTROS_INICIALES_PAGOS, 'estado', '').estado).toBeNull();
    expect(conFiltroPagos(FILTROS_INICIALES_PAGOS, 'desde', '2026-02-01').desde).toBe('2026-02-01');
    // Los filtros nuevos (factura/revisado) usan el mismo camino genérico.
    expect(conFiltroPagos(FILTROS_INICIALES_PAGOS, 'factura', 'ramírez').factura).toBe('ramírez');
    expect(conFiltroPagos(FILTROS_INICIALES_PAGOS, 'revisado_hasta', '2026-04-01').revisado_hasta).toBe(
      '2026-04-01',
    );
    // No pisa los demás filtros.
    const conEstado = { ...FILTROS_INICIALES_PAGOS, estado: 'pendiente' as const };
    expect(conFiltroPagos(conEstado, 'hasta', '2026-03-01').estado).toBe('pendiente');
  });
});

describe('meses cobrables y matrícula por nadador', () => {
  it('febrero a diciembre, sin enero (lo cubre la matrícula)', () => {
    expect(MESES_COBRABLES).toHaveLength(11);
    expect(MESES_COBRABLES).not.toContain('01');
    expect(MESES_COBRABLES).toContain('02');
    expect(MESES_COBRABLES).toContain('12');
  });

  it('los meses disponibles arrancan en el mes de ingreso (nada previo)', () => {
    const anioActual = new Date().getFullYear();
    const grupos = mesesCobrablesDe(`${anioActual - 1}-10-26`);
    // Grupo del año de ingreso: desde octubre (mes >= 10), sin enero.
    expect(grupos[0]!.anio).toBe(anioActual - 1);
    expect(grupos[0]!.claves).toContain(`${anioActual - 1}-10`);
    expect(grupos[0]!.claves).toContain(`${anioActual - 1}-12`);
    expect(grupos[0]!.claves).not.toContain(`${anioActual - 1}-09`);
    expect(grupos[0]!.claves).not.toContain(`${anioActual - 1}-01`);
    // Todos los facturables del año en curso, sin meses futuros de años previos.
    expect(grupos.at(-1)!.anio).toBe(anioActual);
    expect(grupos.at(-1)!.claves).toHaveLength(11);
  });

  it('ingreso en enero ofrece todo el año; ingreso en diciembre solo ese mes', () => {
    const anioActual = new Date().getFullYear();
    const enero = mesesCobrablesDe(`${anioActual}-01-15`);
    expect(enero).toHaveLength(1);
    expect(enero[0]!.claves).toHaveLength(11);

    const diciembre = mesesCobrablesDe(`${anioActual}-12-05`);
    expect(diciembre).toHaveLength(1);
    expect(diciembre[0]!.claves).toEqual([`${anioActual}-12`]);
  });

  it('la matrícula se ofrece solo si el nadador ya había ingresado en ese enero', () => {
    const anioActual = new Date().getFullYear();
    // Ingresó en octubre: enero de ese año ya pasó → solo los años siguientes.
    expect(aniosMatriculaDe(`${anioActual - 1}-10-26`)).toEqual([anioActual]);
    // Ingresó en enero: la matrícula de ese año sí corresponde.
    expect(aniosMatriculaDe(`${anioActual}-01-15`)).toEqual([anioActual]);
    // Ingresó hace dos años: todos los eneros desde entonces.
    expect(aniosMatriculaDe(`${anioActual - 2}-06-01`)).toEqual([
      anioActual - 1,
      anioActual,
    ]);
  });

  it('etiquetaMesAnio muestra el año para no confundir 2025 con 2026', () => {
    expect(etiquetaMesAnio('2025-11')).toBe('Nov 2025');
    expect(etiquetaMesAnio('2026-02')).toBe('Feb 2026');
    expect(etiquetaMesAnio('2026-09')).toBe('Sep 2026');
  });
});

describe('sugerenciasDe (espejo del backend)', () => {
  it('la mensualidad aplica el descuento del afiliado', () => {
    expect(sugerenciasDe(afiliado('0.1000'), plan('35000.00')).valorMensual).toBe('31500.00');
    expect(sugerenciasDe(afiliado('0'), plan('35000.00')).valorMensual).toBe('35000.00');
  });

  it('la matrícula va cruda del plan (el descuento no aplica)', () => {
    expect(sugerenciasDe(afiliado('0.1000'), plan()).valorMatricula).toBe('80000.00');
  });

  it('sin plan cae en 0.00 editable', () => {
    expect(sugerenciasDe(afiliado(), undefined)).toEqual({
      valorMensual: '0.00',
      valorMatricula: '0.00',
    });
  });

  it('coincide con los centavos del backend para varios descuentos', () => {
    const casos: [string, string][] = [
      ['35000.00', '0.0000'],
      ['35000.00', '0.1000'],
      ['74500.00', '0.0500'],
      ['15000.00', '0.0001'],
      ['15000.00', '0.0005'],
      ['99999.99', '0.1234'],
      ['3333.33', '0.3333'],
    ];
    for (const [valor, descuento] of casos) {
      const cliente = sugerenciasDe(afiliado(descuento), plan(valor)).valorMensual;
      const centavos = valorMensualCentavosBackend(valor, descuento);
      expect(cliente).toBe(`${Math.floor(centavos / 100)}.${String(centavos % 100).padStart(2, '0')}`);
    }
  });
});

describe('lineasDesde (día 1 y selección POR nadador)', () => {
  it('cada nadador aporta sus meses con fecha día 1', () => {
    const lineas = lineasDesde([seleccion('0', ['2026-03', '2026-07'])]);
    expect(lineas).toEqual([
      {
        afiliado_id: UUID_AFILIADO,
        concepto: 'mensualidad',
        fecha_cobertura: '2026-03-01',
        monto: '35000.00',
      },
      {
        afiliado_id: UUID_AFILIADO,
        concepto: 'mensualidad',
        fecha_cobertura: '2026-07-01',
        monto: '35000.00',
      },
    ]);
  });

  it('la matrícula cae el 1 de enero del año elegido por ese nadador', () => {
    const lineas = lineasDesde([seleccion('0', [], 2025)]);
    expect(lineas).toEqual([
      {
        afiliado_id: UUID_AFILIADO,
        concepto: 'matricula',
        fecha_cobertura: '2025-01-01',
        monto: '80000.00',
      },
    ]);
  });

  it('sin nadadores o sin meses ni matrícula no hay líneas', () => {
    expect(lineasDesde([])).toEqual([]);
    expect(lineasDesde([seleccion()])).toEqual([]);
  });

  it('mezcla meses de años distintos en un mismo pago (dic-25 + feb-26)', () => {
    const anioActual = new Date().getFullYear();
    const lineas = lineasDesde([
      seleccion('0', [`${anioActual}-02`, `${anioActual - 1}-12`]),
    ]);
    expect(lineas.map((linea) => linea.fecha_cobertura)).toEqual([
      `${anioActual - 1}-12-01`, // cronológico, pese a venir de un año previo
      `${anioActual}-02-01`,
    ]);
  });

  it('dos nadadores con meses distintos = la suma de sus líneas', () => {
    const otro: SeleccionAfiliado = {
      ...nuevaSeleccion(
        { ...afiliado(), id: '55555555-5555-4555-8555-555555555555' },
        plan('30000.00', '70000.00'),
      ),
      meses: ['2026-02', '2026-03', '2026-04'],
    };
    expect(
      lineasDesde([seleccion('0', ['2026-02']), otro]),
    ).toHaveLength(4);
  });
});

describe('totalLineas (decimal.js, nunca `+`)', () => {
  it('suma sin errores de flotante', () => {
    expect(
      totalLineas([
        { afiliado_id: 'a', concepto: 'mensualidad', fecha_cobertura: '2026-03-01', monto: '0.10' },
        { afiliado_id: 'a', concepto: 'mensualidad', fecha_cobertura: '2026-04-01', monto: '0.20' },
      ]),
    ).toBe('0.30');
  });

  it('once mensualidades dan exactos y con 2 decimales', () => {
    const anio = new Date().getFullYear();
    const lineas = lineasDesde([
      seleccion('0', MESES_COBRABLES.map((mes) => `${anio}-${mes}`)),
    ]);
    expect(lineas).toHaveLength(11);
    expect(totalLineas(lineas)).toBe('385000.00');
  });

  it('incluye la matrícula y devuelve 0.00 sin líneas', () => {
    const anio = new Date().getFullYear();
    const lineas = lineasDesde([seleccion('0', [`${anio}-12`], anio)]);
    expect(totalLineas(lineas)).toBe('115000.00');
    expect(totalLineas([])).toBe('0.00');
  });
});

describe('esDineroValido', () => {
  it('acepta el formato de la API y rechaza basura', () => {
    expect(esDineroValido('35000')).toBe(true);
    expect(esDineroValido('35000.00')).toBe(true);
    expect(esDineroValido('35000.5')).toBe(true);
    expect(esDineroValido('0')).toBe(true);
    expect(esDineroValido('')).toBe(false);
    expect(esDineroValido('abc')).toBe(false);
    expect(esDineroValido('35000.123')).toBe(false);
    expect(esDineroValido('035000')).toBe(false);
    expect(esDineroValido('-500')).toBe(false);
  });
});

describe('comprobante (PDF/JPG/PNG/WEBP, máx 10 MB)', () => {
  it('acepta los formatos permitidos y estrecha el MIME', () => {
    expect(validarComprobante({ type: 'application/pdf', size: 1024 })).toBeNull();
    expect(validarComprobante({ type: 'image/jpeg', size: 1024 })).toBeNull();
    expect(validarComprobante({ type: 'image/png', size: 1024 })).toBeNull();
    expect(validarComprobante({ type: 'image/webp', size: 1024 })).toBeNull();
    expect(esMimeComprobante('image/webp')).toBe(true);
    expect(esMimeComprobante('image/gif')).toBe(false);
  });

  it('rechaza otros tipos, el vacío y el exceso de tamaño', () => {
    expect(validarComprobante({ type: 'image/gif', size: 10 })).toContain('Formato no permitido');
    expect(validarComprobante({ type: 'text/plain', size: 10 })).toContain('Formato no permitido');
    expect(validarComprobante({ type: 'application/pdf', size: 0 })).toContain('vacío');
    const diezMb = 10 * 1024 * 1024;
    expect(validarComprobante({ type: 'application/pdf', size: diezMb })).toBeNull();
    expect(validarComprobante({ type: 'application/pdf', size: diezMb + 1 })).toContain('10 MB');
  });

  it('solo el PDF se abre como link; las imágenes tienen preview', () => {
    expect(esImagen('org/comprobante/abc.jpg')).toBe(true);
    expect(esImagen('org/comprobante/abc.webp')).toBe(true);
    expect(esImagen('org/comprobante/abc.pdf')).toBe(false);
    expect(esImagen('org/comprobante/ABC.PDF')).toBe(false);
  });
});

describe('esquemaFacturacion (§4.5)', () => {
  const valido = () => ({
    factura_tipo_documento: 'NIT',
    factura_documento: '900123456-1',
    factura_nombre: 'Acme S.A.S.',
    factura_celular: '3001234567',
    factura_correo: 'FAMILIA@Ejemplo.com',
  });

  it('acepta datos válidos y normaliza para el wire', () => {
    const resultado = esquemaFacturacion.safeParse(valido());
    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.factura_documento).toBe('900123456-1');
      expect(resultado.data.factura_correo).toBe('familia@ejemplo.com');
    }
  });

  it('los vacíos reciben mensaje de campo en español (el refinement es el último issue)', () => {
    const resultado = esquemaFacturacion.safeParse({
      factura_tipo_documento: '',
      factura_documento: '',
      factura_nombre: '   ',
    });
    expect(resultado.success).toBe(false);
    if (resultado.success) return;
    const fallos = resultado.error.issues.map((i) => ({ path: [...i.path], message: i.message }));
    expect(mensajesDe(['factura_tipo_documento'], fallos).at(-1)).toBe(
      'Selecciona un tipo de documento',
    );
    expect(mensajesDe(['factura_documento'], fallos).at(-1)).toBe('Requerido');
    expect(mensajesDe(['factura_nombre'], fallos).at(-1)).toBe('Requerido');
    expect(fallos.some((f) => /expected|too small|invalid input/i.test(f.message))).toBe(false);
  });

  it('con el tipo vacío no emite «Formato inválido» en el documento (la regla del par se salta)', () => {
    const resultado = esquemaFacturacion.safeParse({
      factura_tipo_documento: '',
      factura_documento: 'AB123',
      factura_nombre: 'Familia X',
    });
    expect(resultado.success).toBe(false);
    if (resultado.success) return;
    const fallos = resultado.error.issues.map((i) => ({ path: [...i.path], message: i.message }));
    expect(mensajesDe(['factura_tipo_documento'], fallos)).toEqual([
      'Selecciona un tipo de documento',
    ]);
    expect(mensajesDe(['factura_documento'], fallos)).toEqual([]);
  });

  it('aplica la regla del par (CC solo dígitos) con conGuion para facturación', () => {
    const cc = esquemaFacturacion.safeParse({
      ...valido(),
      factura_tipo_documento: 'CC',
      factura_documento: 'AB123',
    });
    expect(cc.success).toBe(false);
    if (cc.success) return;
    const ccFallos = cc.error.issues.map((i) => ({ path: [...i.path], message: i.message }));
    expect(mensajesDe(['factura_documento'], ccFallos)).toContain('CC requiere solo dígitos');

    const conGuion = esquemaFacturacion.safeParse({
      ...valido(),
      factura_tipo_documento: 'NIT',
      factura_documento: '900 123',
    });
    expect(conGuion.success).toBe(false);
    if (conGuion.success) return;
    const guionFallos = conGuion.error.issues.map((i) => ({ path: [...i.path], message: i.message }));
    expect(mensajesDe(['factura_documento'], guionFallos)).toContain(
      'Formato inválido: solo letras mayúsculas, números y guion',
    );
  });
});

describe('etiquetas y precarga', () => {
  it('cubren todos los valores de los enums', () => {
    for (const tipo of TIPOS_DOCUMENTO_FACTURACION) {
      expect(ETIQUETAS_DOCUMENTO_FACTURACION[tipo]).toBeTruthy();
    }
    for (const tipo of TIPOS_DOCUMENTO) {
      expect(ETIQUETAS_DOCUMENTO_FACTURACION[tipo]).toBeTruthy();
    }
    expect(ETIQUETAS_ESTADO_VERIFICACION).toEqual({
      pendiente: 'Pendiente',
      verificado: 'Verificado',
      rechazado: 'Rechazado',
    });
    expect(ETIQUETAS_CONCEPTO).toEqual({ mensualidad: 'Mensualidad', matricula: 'Matrícula' });
  });

  it('la facturación se precarga desde el nadador elegido', () => {
    expect(facturacionVacia().factura_documento).toBe('');
    const precargada = facturacionDesdeAfiliado(afiliado());
    expect(precargada).toEqual({
      factura_tipo_documento: 'CC',
      factura_documento: '1002345678',
      factura_nombre: 'Sofía Ramírez',
      factura_celular: '3001234567',
      factura_correo: 'familia@ejemplo.com',
    });
    expect(esquemaFacturacion.safeParse(precargada).success).toBe(true);
  });
});
