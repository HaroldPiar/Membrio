/**
 * Transformaciones puras de pagos (Fase 4, Spec del cliente §4.4–4.5) — sin
 * React, para testearlas con Vitest.
 *
 * Reglas del §5 que viven acá:
 *  - el TOTAL del formulario se suma con decimal.js, NUNCA con `+` (§5);
 *  - el valor sugerido de la mensualidad replica el cálculo del backend
 *    (plan × (1 − descuento), services/dashboard.ts) para que
 *    «Cartera → Registrar pago» proponga exactamente lo adeudado;
 *  - los filtros vacíos se OMITEN del query (sin parámetro la API devuelve
 *    todo) y la facturación reutiliza la regla del par (tipo, número).
 */
import Decimal from 'decimal.js';
import { z } from '@hono/zod-openapi';

import { MIME_ACEPTADOS, TAMANO_MAXIMO_BYTES } from '../shared/archivos';
import { dineroSchema } from '../shared/dinero';
import {
  TIPOS_DOCUMENTO_FACTURACION,
  tipoDocumentoFacturacionSchema,
  validarFormatoDocumento,
  type TipoDocumentoFacturacion,
} from '../shared/documento';
import type { estadoPagoSchema } from '../shared/pagos';
import type { Afiliado } from './afiliados-datos';
import type { Plan } from './consultas-afiliados';

// Mensajes de validación en español para este bundle también (patrón de la
// Fase 3): idempotente si afiliados-datos ya lo configuró.
z.config(z.locales.es());

// ---------------------------------------------------------------------------
// Estados de verificación y conceptos
// ---------------------------------------------------------------------------

export type EstadoVerificacion = z.infer<typeof estadoPagoSchema>;

export const ETIQUETAS_ESTADO_VERIFICACION: Record<EstadoVerificacion, string> = {
  pendiente: 'Pendiente',
  verificado: 'Verificado',
  rechazado: 'Rechazado',
};

/** Opciones del filtro de encabezado (formato de FiltroColumna). */
export const OPCIONES_ESTADO_VERIFICACION: { valor: EstadoVerificacion; etiqueta: string }[] = (
  Object.entries(ETIQUETAS_ESTADO_VERIFICACION) as [EstadoVerificacion, string][]
).map(([valor, etiqueta]) => ({ valor, etiqueta }));

export type ConceptoLinea = 'mensualidad' | 'matricula';

export const ETIQUETAS_CONCEPTO: Record<ConceptoLinea, string> = {
  mensualidad: 'Mensualidad',
  matricula: 'Matrícula',
};

// ---------------------------------------------------------------------------
// Filtros del listado (§4.4: pestañas Por verificar e Historial)
// ---------------------------------------------------------------------------

export type FiltrosPagos = {
  estado: EstadoVerificacion | null;
  desde: string;
  hasta: string;
  /** Texto parcial sobre factura_nombre / factura_documento. */
  factura: string;
  /** Fecha de verificación (revisado_en), rango o fecha única. */
  revisado_desde: string;
  revisado_hasta: string;
};

export const FILTROS_INICIALES_PAGOS: FiltrosPagos = {
  estado: null,
  desde: '',
  hasta: '',
  factura: '',
  revisado_desde: '',
  revisado_hasta: '',
};

/** Bandeja de trabajo: la pestaña Por verificar es el filtro estado=pendiente. */
export const FILTROS_PENDIENTES: FiltrosPagos = { ...FILTROS_INICIALES_PAGOS, estado: 'pendiente' };

export const LIMITE_PAGOS = 20;

export type CamposFiltroPagos =
  | 'estado'
  | 'desde'
  | 'hasta'
  | 'factura'
  | 'revisado_desde'
  | 'revisado_hasta';

export type ParametrosPagos = {
  limit: number;
  cursor?: string;
  estado?: EstadoVerificacion;
  desde?: string;
  hasta?: string;
  factura?: string;
  revisado_desde?: string;
  revisado_hasta?: string;
};

/** Filtros + cursor → query de GET /pagos. Los vacíos se OMITEN (§4.4). */
export function parametrosPagos(filtros: FiltrosPagos, cursor?: string): ParametrosPagos {
  const parametros: ParametrosPagos = { limit: LIMITE_PAGOS };
  if (filtros.estado) parametros.estado = filtros.estado;
  if (filtros.desde) parametros.desde = filtros.desde;
  if (filtros.hasta) parametros.hasta = filtros.hasta;
  if (filtros.factura.trim()) parametros.factura = filtros.factura.trim();
  if (filtros.revisado_desde) parametros.revisado_desde = filtros.revisado_desde;
  if (filtros.revisado_hasta) parametros.revisado_hasta = filtros.revisado_hasta;
  if (cursor) parametros.cursor = cursor;
  return parametros;
}

/** Transición de un filtro (string del control) al estado tipado. '' = sin filtro. */
export function conFiltroPagos(
  filtros: FiltrosPagos,
  campo: CamposFiltroPagos,
  valor: string,
): FiltrosPagos {
  if (campo === 'estado') {
    const estado = valor === '' ? null : (valor as EstadoVerificacion);
    return { ...filtros, estado };
  }
  return { ...filtros, [campo]: valor };
}

/** ¿Hay algún filtro activo? (copia de vacío y botón «Limpiar filtros»). */
export function hayFiltrosPagos(filtros: FiltrosPagos): boolean {
  return (
    filtros.estado !== null ||
    filtros.desde !== '' ||
    filtros.hasta !== '' ||
    filtros.factura.trim() !== '' ||
    filtros.revisado_desde !== '' ||
    filtros.revisado_hasta !== ''
  );
}

// ---------------------------------------------------------------------------
// Meses cobrables (§4.5)
// ---------------------------------------------------------------------------

/** Febrero a diciembre: enero no es facturable — lo cubre la matrícula (§8.2). */
export const MESES_COBRABLES = [
  '02',
  '03',
  '04',
  '05',
  '06',
  '07',
  '08',
  '09',
  '10',
  '11',
  '12',
] as const;

export const NOMBRES_MES: Record<string, string> = {
  '01': 'Enero',
  '02': 'Febrero',
  '03': 'Marzo',
  '04': 'Abril',
  '05': 'Mayo',
  '06': 'Junio',
  '07': 'Julio',
  '08': 'Agosto',
  '09': 'Septiembre',
  '10': 'Octubre',
  '11': 'Noviembre',
  '12': 'Diciembre',
};

/**
 * Claves 'AAAA-MM' cobrables para un nadador, agrupadas por año en orden
 * cronológico: desde SU mes de ingreso (inclusive) hasta diciembre del año
 * en curso. Solo meses facturables (feb–dic): enero lo cubre la matrícula.
 * Un pago nunca puede cubrir meses previos a la inscripción.
 */
export function mesesCobrablesDe(fechaIngreso: string): { anio: number; claves: string[] }[] {
  const [anioIngreso, mesIngreso] = fechaIngreso.split('-').map(Number);
  if (!anioIngreso || !mesIngreso) return [];
  const anioActual = new Date().getFullYear();
  const grupos: { anio: number; claves: string[] }[] = [];
  for (let anio = anioIngreso; anio <= anioActual; anio += 1) {
    const claves: string[] = [];
    for (const mes of MESES_COBRABLES) {
      if (anio === anioIngreso && Number(mes) < mesIngreso) continue;
      claves.push(`${anio}-${mes}`);
    }
    if (claves.length > 0) grupos.push({ anio, claves });
  }
  return grupos;
}

/**
 * Años de matrícula ofrecidos: enero de cada año desde el de ingreso (solo
 * si el nadador ya había ingresado en ese enero) hasta el año en curso.
 */
export function aniosMatriculaDe(fechaIngreso: string): number[] {
  const [anioIngreso, mesIngreso] = fechaIngreso.split('-').map(Number);
  if (!anioIngreso || !mesIngreso) return [];
  const anioActual = new Date().getFullYear();
  const anios: number[] = [];
  for (let anio = anioIngreso; anio <= anioActual; anio += 1) {
    if (anio === anioIngreso && mesIngreso > 1) continue;
    anios.push(anio);
  }
  return anios;
}

/** '2025-11' → 'Nov 2025' (chip de mes con año para no confundir 2025/2026). */
export function etiquetaMesAnio(clave: string): string {
  return `${NOMBRES_MES[clave.slice(5, 7)]?.slice(0, 3) ?? clave.slice(5, 7)} ${clave.slice(0, 4)}`;
}

// ---------------------------------------------------------------------------
// Selección de nadadores y líneas del pago (§4.5)
// ---------------------------------------------------------------------------

export type SeleccionAfiliado = {
  afiliado: Afiliado;
  /** Mensualidad YA con el descuento del afiliado (editable por el operador). */
  valorMensual: string;
  /** Matrícula al valor crudo del plan (el descuento no aplica, editable). */
  valorMatricula: string;
  /** Claves 'AAAA-MM' marcadas POR ESTE nadador (cada uno cubre lo suyo). */
  meses: string[];
  /** Año de la matrícula marcada; null = sin matrícula. */
  matriculaAnio: number | null;
};

/** Nadador recién elegido: valores sugeridos y sin meses marcados. */
export function nuevaSeleccion(afiliado: Afiliado, plan: Plan | undefined): SeleccionAfiliado {
  return { afiliado, ...sugerenciasDe(afiliado, plan), meses: [], matriculaAnio: null };
}

export type LineaPago = {
  afiliado_id: string;
  concepto: ConceptoLinea;
  fecha_cobertura: string;
  monto: string;
};

/**
 * Valores sugeridos para un nadador: la mensualidad con el descuento del
 * afiliado (decimal.js, 2 decimales HALF_UP — mismo resultado que los
 * centavos enteros del backend) y la matrícula cruda del plan.
 */
export function sugerenciasDe(
  afiliado: Afiliado,
  plan: Plan | undefined,
): { valorMensual: string; valorMatricula: string } {
  const base = plan?.valor_mensualidad ?? '0.00';
  const valorMensual = new Decimal(base)
    .mul(new Decimal(1).minus(new Decimal(afiliado.descuento)))
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    .toFixed(2);
  return { valorMensual, valorMatricula: plan?.valor_matricula ?? '0.00' };
}

/**
 * Selección × meses → líneas del request. Cada nadador aporta SUS meses
 * ('AAAA-MM', posible mezcla entre años) y su matrícula opcional.
 * `fecha_cobertura` es SIEMPRE día 1 (§5) y la matrícula cae el 1 de enero
 * del año elegido (§8.2). Las líneas salen ordenadas por nadador y, dentro
 * de cada uno, cronológicamente.
 */
export function lineasDesde(selecciones: readonly SeleccionAfiliado[]): LineaPago[] {
  const lineas: LineaPago[] = [];
  for (const seleccion of selecciones) {
    for (const clave of [...seleccion.meses].sort()) {
      lineas.push({
        afiliado_id: seleccion.afiliado.id,
        concepto: 'mensualidad',
        fecha_cobertura: `${clave}-01`,
        monto: seleccion.valorMensual,
      });
    }
    if (seleccion.matriculaAnio !== null) {
      lineas.push({
        afiliado_id: seleccion.afiliado.id,
        concepto: 'matricula',
        fecha_cobertura: `${seleccion.matriculaAnio}-01-01`,
        monto: seleccion.valorMatricula,
      });
    }
  }
  return lineas;
}

/**
 * Total del formulario con decimal.js (§5: «se suma con una librería
 * decimal, no con `+`»). Devuelve cadena con 2 decimales, lista para
 * monto_total — la API revalida la igualdad contra la suma real.
 */
export function totalLineas(lineas: readonly LineaPago[]): string {
  return lineas
    .reduce((suma, linea) => suma.plus(new Decimal(linea.monto)), new Decimal(0))
    .toFixed(2);
}

/** ¿El valor tipeado es un monto aceptable por dineroSchema? */
export function esDineroValido(valor: string): boolean {
  return dineroSchema.safeParse(valor).success;
}

// ---------------------------------------------------------------------------
// Comprobante (§4.5: PDF/JPG/PNG/WEBP, máx 10 MB, URL firmada)
// ---------------------------------------------------------------------------

const MIME_COMPROBANTE = Object.keys(MIME_ACEPTADOS) as [string, ...string[]];

/** MIME permitidos (el tipo del File, para estrechar el body de subida). */
export type MimeComprobante = keyof typeof MIME_ACEPTADOS;

export function esMimeComprobante(tipo: string): tipo is MimeComprobante {
  return Object.prototype.hasOwnProperty.call(MIME_ACEPTADOS, tipo);
}

/** Atributo `accept` del input de archivo. */
export const ACEPTACION_COMPROBANTE = MIME_COMPROBANTE.join(',');

/** Validación en el navegador ANTES de pedir la URL firmada. null = ok. */
export function validarComprobante(archivo: { type: string; size: number }): string | null {
  if (!MIME_COMPROBANTE.includes(archivo.type)) {
    return 'Formato no permitido: sube un PDF, JPG, PNG o WEBP.';
  }
  if (archivo.size < 1) return 'El archivo está vacío.';
  if (archivo.size > TAMANO_MAXIMO_BYTES) return 'El archivo supera los 10 MB.';
  return null;
}

/** ¿La ruta es imagen (preview embebido) o PDF (link de apertura)? */
export function esImagen(ruta: string): boolean {
  return !ruta.toLowerCase().endsWith('.pdf');
}

// ---------------------------------------------------------------------------
// Datos de facturación (§4.5: precargados pero editables, tipo obligatorio)
// ---------------------------------------------------------------------------

export const ETIQUETAS_DOCUMENTO_FACTURACION: Record<TipoDocumentoFacturacion, string> = {
  TI: 'Tarjeta de identidad',
  CC: 'Cédula de ciudadanía',
  RC: 'Registro civil',
  PAS: 'Pasaporte',
  PPT: 'Permiso especial de permanencia',
  NIT: 'NIT (empresa)',
};

/**
 * Bloque de facturación del formulario: mismo formato que el body del API
 * (trim, mayúsculas del documento, minúsculas del correo) y la regla del par
 * con `conGuion` (NIT lleva dígito de verificación: 900123456-1).
 * Los «Requerido» van en el refinement, DESPUÉS de los checks base — el
 * mismo truco verificado en el formulario de afiliados (su mensaje es el
 * que queda al aplanar).
 *
 * OJO con el tipo: NO es un `z.enum` a secas. En Zod 4 un issue
 * `invalid_value` del enum ABORTA el refinamiento entero (el `superRefine`
 * ni corre), así que el select vacío perdería todos los mensajes de campo.
 * El `refine` de membresía + `pipe` al enum: mismo resultado en el wire y el
 * refinement sigue corriendo (issue dirty, no abort).
 */
export const esquemaFacturacion = z
  .object({
    factura_tipo_documento: z
      .string()
      .trim()
      .refine(
        (valor) => (TIPOS_DOCUMENTO_FACTURACION as readonly string[]).includes(valor),
        { message: 'Selecciona un tipo de documento' },
      )
      .pipe(tipoDocumentoFacturacionSchema),
    factura_documento: z.string().trim().toUpperCase().min(3).max(20),
    factura_nombre: z.string().trim().min(1).max(160),
    factura_celular: z.string().trim().max(30).optional(),
    factura_correo: z.string().trim().toLowerCase().max(160).optional(),
  })
  .superRefine((valor, ctx) => {
    // La regla del par solo aplica con los DOS valores usables: con el tipo
    // vacío (select en '') no hay forma de evaluarla y no debe ensuciar el
    // campo documento con un «Formato inválido» falso.
    if (valor.factura_tipo_documento && valor.factura_documento) {
      validarFormatoDocumento(
        valor.factura_tipo_documento,
        valor.factura_documento,
        ctx,
        ['factura_documento'],
        { conGuion: true },
      );
    }
    if (!valor.factura_documento.trim()) {
      ctx.addIssue({ code: 'custom', path: ['factura_documento'], message: 'Requerido' });
    }
    if (!valor.factura_nombre.trim()) {
      ctx.addIssue({ code: 'custom', path: ['factura_nombre'], message: 'Requerido' });
    }
  });

export type ValoresFacturacion = z.input<typeof esquemaFacturacion>;
export type DatosFacturacion = z.output<typeof esquemaFacturacion>;

/** Valores vacíos del bloque de facturación (se precargan al elegir nadador). */
export function facturacionVacia(): ValoresFacturacion {
  return {
    factura_tipo_documento: 'CC',
    factura_documento: '',
    factura_nombre: '',
    factura_celular: '',
    factura_correo: '',
  };
}

/** Precarga desde el primer nadador elegido: sus datos ya son los de la familia. */
export function facturacionDesdeAfiliado(afiliado: Afiliado): ValoresFacturacion {
  return {
    factura_tipo_documento: afiliado.tipo_documento,
    factura_documento: afiliado.numero_documento,
    factura_nombre: afiliado.nombre,
    factura_celular: afiliado.celular,
    factura_correo: afiliado.correo,
  };
}
