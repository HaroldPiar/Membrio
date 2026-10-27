/**
 * Esquemas wire de afiliados (spec §9).
 *
 * - Claves en paridad con las columnas (snake_case); documento como claves
 *   hermanas tipo_documento/numero_documento con la regla del par (§7).
 * - `estado_pago` NUNCA se almacena: se calcula en services/estado-pago.ts
 *   y se agrega solo en respuestas.
 * - Filtros de listado: q, activo, categoria, plan, estado_pago (spec §9).
 */
import { z } from '@hono/zod-openapi';

import { fecha, idSchema, instante } from './catalogos';
import { paginacionQuerySchema } from './paginacion';
import { TIPOS_DOCUMENTO, validarFormatoDocumento } from './documento';

/** Estados de pago calculados (copy de UI: "Al día", "Por vencer", "En mora"). */
export const estadoPagoSchema = z
  .enum(['al_dia', 'por_vencer', 'en_mora'])
  .openapi({ example: 'al_dia', description: 'Estado calculado; no se almacena' });

export const tipoSangreSchema = z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']);

const fechaNacimiento = fecha.openapi({ example: '2014-03-15' });

/** Fracción 0..1 con hasta 4 decimales (columna numeric(5,4); NO es dinero). */
const fraccionSchema = z
  .string()
  .trim()
  .regex(/^(?:0(?:\.\d{1,4})?|1(?:\.0{1,4})?)$/, 'Debe ser una fracción entre 0 y 1 (ej. "0.1000")')
  .openapi({ example: '0.1000' });

const documentoBase = {
  tipo_documento: z.enum(TIPOS_DOCUMENTO),
  numero_documento: z.string().trim().toUpperCase().min(3).max(20),
};

export const afiliadoSchema = z
  .object({
    id: idSchema,
    plan_id: idSchema,
    categoria_id: idSchema,
    tipo_documento: z.enum(TIPOS_DOCUMENTO),
    numero_documento: z.string().openapi({ example: '1002345678' }),
    nombre: z.string().openapi({ example: 'Sofía Ramírez' }),
    celular: z.string().openapi({ example: '3001234567' }),
    correo: z.string().openapi({ example: 'familia@ejemplo.com' }),
    eps_id: idSchema.nullable(),
    tipo_sangre: tipoSangreSchema,
    fecha_nacimiento: fechaNacimiento,
    genero: z.string().nullable(),
    medio_captacion: z.string().nullable(),
    direccion: z.string().nullable(),
    descuento: fraccionSchema.openapi({ example: '0.0000', description: 'Fracción entre 0 y 1' }),
    fecha_ingreso: fecha,
    fecha_retiro: fecha.nullable(),
    motivo_retiro: z.string().nullable(),
    activo: z.boolean(),
    fecha_consentimiento: fecha.nullable(),
    url_documentos: z.array(z.string()).nullable(),
    created_at: instante,
    updated_at: instante,
    estado_pago: estadoPagoSchema.nullable().openapi({
      description: 'Solo en detalle y listado: calculado, null si el afiliado está retirado',
    }),
  })
  .openapi('Afiliado');

/** Alta: excluye columnas derivadas (retiro, estado, timestamps). */
const afiliadoCreacionBase = z.object({
  plan_id: idSchema,
  categoria_id: idSchema,
  ...documentoBase,
  nombre: z.string().trim().min(1).max(120),
  celular: z.string().trim().min(1).max(30),
  correo: z.string().trim().toLowerCase().max(160),
  eps_id: idSchema.nullish(),
  tipo_sangre: tipoSangreSchema,
  fecha_nacimiento: fechaNacimiento,
  genero: z.string().trim().max(60).nullish(),
  medio_captacion: z.string().trim().max(60).nullish(),
  direccion: z.string().trim().max(240).nullish(),
  descuento: fraccionSchema.default('0'),
  fecha_ingreso: fecha,
  fecha_consentimiento: fecha.nullish(),
});

/** Alta: excluye columnas derivadas (retiro, estado, timestamps). */
export const afiliadoCreacionSchema = afiliadoCreacionBase
  .superRefine((v, ctx) => validarFormatoDocumento(v.tipo_documento, v.numero_documento, ctx))
  .openapi('AfiliadoCreacion');

/** Edición: lo mismo pero casi todo opcional; retiro y activo NO (son POST /retiro). */
export const afiliadoActualizacionSchema = afiliadoCreacionBase
  .partial()
  .superRefine((v, ctx) => {
    if (v.tipo_documento !== undefined && v.numero_documento !== undefined) {
      validarFormatoDocumento(v.tipo_documento, v.numero_documento, ctx);
    } else if (v.numero_documento !== undefined || v.tipo_documento !== undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['numero_documento'],
        message: 'tipo_documento y numero_documento se envían juntos',
      });
    }
  });

export const afiliadoFiltrosSchema = paginacionQuerySchema.extend({
  q: z.string().trim().min(1).max(120).optional().openapi({
    description: 'Búsqueda por nombre o número de documento (parcial, case-insensitive)',
    example: 'ramirez',
  }),
  activo: z.coerce.boolean().optional().openapi({
    description: 'true/false; sin este parámetro se devuelven ambos',
  }),
  categoria: idSchema.optional(),
  plan: idSchema.optional(),
  estado_pago: estadoPagoSchema.optional().openapi({
    description: 'Requiere calcular el estado de cada afiliado; solo afiliados activos',
  }),
  orden: z.enum(['nombre', 'documento']).default('nombre').openapi({
    description: 'Campo de orden del listado; por defecto nombre',
  }),
  direccion: z.enum(['asc', 'desc']).default('asc').openapi({
    description: 'Dirección del orden; por defecto ascendente',
  }),
});

export const retiroSchema = z
  .object({
    fecha_retiro: fecha.optional().openapi({
      description: 'Fecha del retiro; por defecto hoy (zona America/Bogota)',
    }),
    motivo_retiro: z.string().trim().min(1).max(500).optional(),
  })
  .openapi('Retiro');
