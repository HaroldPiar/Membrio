/**
 * Transformaciones puras de afiliados (Fase 3, Spec del cliente §4.3) — sin
 * React, para testearlas con Vitest.
 *
 * Los esquemas de formulario REUTILIZAN los de `src/shared` (§4.3): aquí solo
 * se les agrega el bloque opcional de acudiente del alta y la normalización
 * de vacíos. La validación de documento (regla del par CC/TI) sigue siendo la
 * compartida — ver `superRefine` preservado por `extend` (Zod 4 mantiene los
 * checks al extender).
 */
import { z } from '@hono/zod-openapi';

import { acudienteCreacionSchema, acudienteSchema } from '../shared/acudientes';
import { afiliadoCreacionSchema, afiliadoSchema, estadoPagoSchema } from '../shared/afiliados';
import type { TipoDocumento } from '../shared/documento';

// Mensajes de validación en español para TODO lo que valide el cliente
// (Zod 4 trae locale global; solo afecta a este bundle, no al servidor — los
// tests de mensajes del backend corren en su propio proceso aislado).
z.config(z.locales.es());

export type Afiliado = z.infer<typeof afiliadoSchema>;
export type Acudiente = z.infer<typeof acudienteSchema>;
export type EstadoPagoAfiliado = z.infer<typeof estadoPagoSchema>;

// ---------------------------------------------------------------------------
// Filtros del listado
// ---------------------------------------------------------------------------

export type FiltrosAfiliados = {
  q: string;
  activo: boolean | null;
  categoria: string;
  plan: string;
  estado_pago: EstadoPagoAfiliado | null;
};

export const FILTROS_INICIALES: FiltrosAfiliados = {
  q: '',
  activo: null,
  categoria: '',
  plan: '',
  estado_pago: null,
};

export const LIMITE_LISTADO = 20;

/**
 * Filtros + cursor → parámetros de query del listado. Los vacíos se OMITEN
 * (sin el parámetro la API devuelve todo), nunca mandan ''.
 */
export function parametrosListado(
  filtros: FiltrosAfiliados,
  cursor?: string,
): {
  limit: number;
  cursor?: string;
  q?: string;
  activo?: boolean;
  categoria?: string;
  plan?: string;
  estado_pago?: EstadoPagoAfiliado;
} {
  const parametros: {
    limit: number;
    cursor?: string;
    q?: string;
    activo?: boolean;
    categoria?: string;
    plan?: string;
    estado_pago?: EstadoPagoAfiliado;
  } = { limit: LIMITE_LISTADO };

  const q = filtros.q.trim();
  if (q) parametros.q = q;
  if (filtros.activo !== null) parametros.activo = filtros.activo;
  if (filtros.categoria) parametros.categoria = filtros.categoria;
  if (filtros.plan) parametros.plan = filtros.plan;
  if (filtros.estado_pago) parametros.estado_pago = filtros.estado_pago;
  if (cursor) parametros.cursor = cursor;
  return parametros;
}

/**
 * Transición de un filtro de encabezado (siempre llega como string del
 * desplegable) al estado tipado. '' = sin filtro.
 */
export function conFiltro(
  filtros: FiltrosAfiliados,
  campo: 'activo' | 'categoria' | 'plan' | 'estado_pago',
  valor: string,
): FiltrosAfiliados {
  if (campo === 'activo') {
    return { ...filtros, activo: valor === '' ? null : valor === 'true' };
  }
  if (campo === 'estado_pago') {
    const estado = valor === '' ? null : (valor as EstadoPagoAfiliado);
    return { ...filtros, estado_pago: estado };
  }
  return { ...filtros, [campo]: valor };
}

/** Los filtros activos se mandan a la URL para que el enlace sea compartible. */
export function filtrosAUrl(filtros: FiltrosAfiliados): string {
  const parametros = new URLSearchParams();
  const q = filtros.q.trim();
  if (q) parametros.set('q', q);
  if (filtros.activo !== null) parametros.set('activo', String(filtros.activo));
  if (filtros.categoria) parametros.set('categoria', filtros.categoria);
  if (filtros.plan) parametros.set('plan', filtros.plan);
  if (filtros.estado_pago) parametros.set('estado', filtros.estado_pago);
  const texto = parametros.toString();
  return texto ? `/afiliados?${texto}` : '/afiliados';
}

/** Lee la URL inicial (enlace del dashboard: /afiliados?estado=en_mora). */
export function filtrosDeUrl(
  params: URLSearchParams,
): { estado_pago: EstadoPagoAfiliado | null; q: string; activo: boolean | null } {
  const estado = params.get('estado');
  const estadoPago =
    estado === 'al_dia' || estado === 'por_vencer' || estado === 'en_mora' ? estado : null;
  const activo = params.get('activo');
  return {
    estado_pago: estadoPago,
    q: params.get('q') ?? '',
    activo: activo === 'true' ? true : activo === 'false' ? false : null,
  };
}

// ---------------------------------------------------------------------------
// Etiquetas
// ---------------------------------------------------------------------------

/** CC → 'Cédula de ciudadanía' (copy de formulario, no del wire). */
export const ETIQUETAS_DOCUMENTO: Record<TipoDocumento, string> = {
  TI: 'Tarjeta de identidad',
  CC: 'Cédula de ciudadanía',
  RC: 'Registro civil',
  PAS: 'Pasaporte',
  PPT: 'Permiso especial de permanencia',
};

export const ETIQUETAS_ESTADO_PAGO: Record<EstadoPagoAfiliado, string> = {
  al_dia: 'Al día',
  por_vencer: 'Por vencer',
  en_mora: 'En mora',
};

/**
 * '0.1000' (fracción del schema, numeric(5,4)) → '10 %'. Aritmética ENTERA
 * sobre dígitos: jamás `Number(fraccion) * 100` (0.1 × 100 deja restos
 * flotantes). El descuento no es dinero, pero la exactitud es el mismo capo.
 */
export function fraccionAPorcentaje(fraccion: string): string {
  const [enteros, decimales = ''] = fraccion.split('.');
  const centesimas = decimales.padEnd(4, '0');
  const enterosPorcentaje = Number(enteros) * 100 + Number(centesimas.slice(0, 2));
  const resto = centesimas.slice(2);
  if (resto === '00') return `${enterosPorcentaje} %`;
  return `${enterosPorcentaje}.${resto} %`;
}

// ---------------------------------------------------------------------------
// Esquemas de formulario
// ---------------------------------------------------------------------------

const bloqueAcudiente = z.object({
  numero_documento: z.string().optional(),
  nombre: z.string().optional(),
  celular: z.string().optional(),
  correo: z.string().optional(),
});

export type ValoresAcudiente = z.infer<typeof bloqueAcudiente>;

/** ¿El bloque de acudiente del alta trae algo escrito? */
export function acudienteConContenido(acudiente: ValoresAcudiente | undefined): boolean {
  if (!acudiente) return false;
  return [
    acudiente.numero_documento,
    acudiente.nombre,
    acudiente.celular,
    acudiente.correo,
  ].some((campo) => (campo ?? '').trim() !== '');
}

/** '' → null en los opcionales y es_principal (único del alta). Listo para el wire. */
export function acudienteParaEnviar(acudiente: ValoresAcudiente) {
  const parseado = acudienteCreacionSchema.parse({
    numero_documento: (acudiente.numero_documento ?? '').trim(),
    nombre: (acudiente.nombre ?? '').trim(),
    celular: acudiente.celular?.trim() || null,
    correo: acudiente.correo?.trim() || null,
    es_principal: true,
  });
  // Claves presentes y tipadas (exactOptionalPropertyTypes no acepta que la
  // clave sea `| undefined` explícito al armar el body).
  return {
    numero_documento: parseado.numero_documento,
    nombre: parseado.nombre,
    celular: parseado.celular ?? null,
    correo: parseado.correo ?? null,
    es_principal: parseado.es_principal,
  };
}

/**
 * Formulario de alta y edición: el esquema compartido de creación (misma
 * validación de documento, transforms y límites) + bloque opcional de
 * acudiente. En edición el bloque no se renderiza y queda ausente.
 */
export const esquemaFormularioAfiliado = afiliadoCreacionSchema
  .extend({ acudiente: bloqueAcudiente.optional() })
  .superRefine((valor, ctx) => {
    // Mensajes de campo para lo vacío: el error base de Zod ahí es poco
    // claro en pantalla ('Inválido UUID' en un select sin tocar). El
    // refinement va DESPUÉS de los checks base, así que su mensaje es el
    // que queda al aplanar (verificado en test).
    const requerido = (campos: (string | undefined)[], ruta: string, mensaje: string) => {
      if (campos.every((campo) => (campo ?? '').trim() !== '')) return;
      ctx.addIssue({ code: 'custom', path: [ruta], message: mensaje });
    };
    requerido([valor.numero_documento], 'numero_documento', 'Requerido');
    requerido([valor.nombre], 'nombre', 'Requerido');
    requerido([valor.celular], 'celular', 'Requerido');
    requerido([valor.fecha_nacimiento], 'fecha_nacimiento', 'Requerido');
    requerido([valor.fecha_ingreso], 'fecha_ingreso', 'Requerido');
    requerido([valor.plan_id], 'plan_id', 'Selecciona un plan');
    requerido([valor.categoria_id], 'categoria_id', 'Selecciona una categoría');

    const acudiente = valor.acudiente;
    if (!acudiente || !acudienteConContenido(acudiente)) return;
    const validacion = acudienteCreacionSchema.safeParse({
      numero_documento: (acudiente.numero_documento ?? '').trim(),
      nombre: (acudiente.nombre ?? '').trim(),
      celular: acudiente.celular?.trim() || null,
      correo: acudiente.correo?.trim() || null,
      es_principal: true,
    });
    if (!validacion.success) {
      for (const problema of validacion.error.issues) {
        ctx.addIssue({
          code: 'custom',
          path: ['acudiente', ...problema.path],
          message: problema.message,
        });
      }
    }
    // Vacíos del bloque: 'Requerido' DESPUÉS de los del esquema compartido,
    // para que sea el mensaje que quede al aplanar.
    if (!(acudiente.numero_documento ?? '').trim()) {
      ctx.addIssue({ code: 'custom', path: ['acudiente', 'numero_documento'], message: 'Requerido' });
    }
    if (!(acudiente.nombre ?? '').trim()) {
      ctx.addIssue({ code: 'custom', path: ['acudiente', 'nombre'], message: 'Requerido' });
    }
  });

export type ValoresFormularioAfiliado = z.input<typeof esquemaFormularioAfiliado>;
export type DatosFormularioAfiliado = z.output<typeof esquemaFormularioAfiliado>;

/**
 * Valores por defecto del formulario de edición. Los nullable vacíos salen
 * `undefined` (input sin valor); si el usuario los limpia, `setValueAs`
 * manda null y la API borra el dato.
 */
export function valoresEdicion(afiliado: Afiliado): ValoresFormularioAfiliado {
  return {
    tipo_documento: afiliado.tipo_documento,
    numero_documento: afiliado.numero_documento,
    nombre: afiliado.nombre,
    fecha_nacimiento: afiliado.fecha_nacimiento,
    genero: afiliado.genero ?? undefined,
    celular: afiliado.celular,
    correo: afiliado.correo,
    direccion: afiliado.direccion ?? undefined,
    eps_id: afiliado.eps_id ?? undefined,
    tipo_sangre: afiliado.tipo_sangre,
    plan_id: afiliado.plan_id,
    categoria_id: afiliado.categoria_id,
    fecha_ingreso: afiliado.fecha_ingreso,
    descuento: afiliado.descuento,
    medio_captacion: afiliado.medio_captacion ?? undefined,
    fecha_consentimiento: afiliado.fecha_consentimiento ?? undefined,
  };
}

/** Valores iniciales del alta (fechas vacías, descuento 0). */
export function valoresAlta(): ValoresFormularioAfiliado {
  return {
    tipo_documento: 'CC',
    numero_documento: '',
    nombre: '',
    fecha_nacimiento: '',
    genero: undefined,
    celular: '',
    correo: '',
    direccion: undefined,
    eps_id: undefined,
    tipo_sangre: 'O+',
    plan_id: '',
    categoria_id: '',
    fecha_ingreso: '',
    descuento: '0',
    medio_captacion: undefined,
    fecha_consentimiento: undefined,
  };
}
