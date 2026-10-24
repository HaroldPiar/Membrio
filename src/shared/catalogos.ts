/**
 * Esquemas wire de catálogos (spec §9): planes, categorías y eps.
 * Convención: claves snake_case en paridad con las columnas de la base;
 * montos como cadenas decimales (nunca number).
 */
import { z } from '@hono/zod-openapi';

import { dineroSchema } from './dinero';

export const idSchema = z.uuid().openapi({ example: '0b6f8f5e-8f4e-4a2b-9d3a-1c2b3d4e5f60' });

const fechaSchema = z.iso.date().openapi({ example: '2026-02-01' });
const instanteSchema = z.iso.datetime().openapi({ example: '2026-02-15T10:30:00.000Z' });

export const fecha = fechaSchema;
export const instante = instanteSchema;

// ---------------------------------------------------------------------------
// Planes (escritura solo admin)
// ---------------------------------------------------------------------------

export const planSchema = z
  .object({
    id: idSchema,
    nombre: z.string().openapi({ example: 'Básico' }),
    valor_mensualidad: dineroSchema,
    valor_matricula: dineroSchema,
    activo: z.boolean(),
    created_at: instanteSchema,
    updated_at: instanteSchema,
  })
  .openapi('Plan');

export const planCreacionSchema = z
  .object({
    nombre: z.string().trim().min(1).max(120).openapi({ example: 'Básico' }),
    valor_mensualidad: dineroSchema,
    valor_matricula: dineroSchema,
  })
  .openapi('PlanCreacion');

export const planActualizacionSchema = planCreacionSchema.partial().refine(
  (v) => Object.keys(v).length > 0,
  { message: 'Debe enviar al menos un campo' },
);

// ---------------------------------------------------------------------------
// Categorías (cursos) — escritura solo admin
// ---------------------------------------------------------------------------

export const categoriaSchema = z
  .object({
    id: idSchema,
    nombre: z.string().openapi({ example: 'Sub-10 Mariposa' }),
    activa: z.boolean(),
    created_at: instanteSchema,
    updated_at: instanteSchema,
  })
  .openapi('Categoria');

export const categoriaCreacionSchema = z
  .object({
    nombre: z.string().trim().min(1).max(120).openapi({ example: 'Sub-10 Mariposa' }),
  })
  .openapi('CategoriaCreacion');

export const categoriaActualizacionSchema = categoriaCreacionSchema.partial().refine(
  (v) => Object.keys(v).length > 0,
  { message: 'Debe enviar al menos un campo' },
);

// ---------------------------------------------------------------------------
// EPS (catálogo global, solo lectura)
// ---------------------------------------------------------------------------

export const epsSchema = z
  .object({
    id: idSchema,
    nombre: z.string().openapi({ example: 'EPS Salud Total' }),
    activa: z.boolean(),
  })
  .openapi('Eps');
