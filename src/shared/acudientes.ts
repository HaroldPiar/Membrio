/**
 * Esquemas wire de acudientes (spec §9).
 * Sin tipo_documento en la base: solo numero_documento (formato general
 * alfanumérico MAYÚSCULAS, sin guion — CHECK ^[A-Z0-9]+$ en la tabla).
 */
import { z } from '@hono/zod-openapi';

import { idSchema, instante } from './catalogos';
import { numeroDocumentoSchema } from './documento';

export const acudienteSchema = z
  .object({
    id: idSchema,
    afiliado_id: idSchema,
    numero_documento: z.string().openapi({ example: '79123456' }),
    nombre: z.string().openapi({ example: 'Carlos Ramírez' }),
    celular: z.string().nullable(),
    correo: z.string().nullable(),
    es_principal: z.boolean().openapi({
      description: 'Un solo principal por afiliado (índice único parcial en la base)',
    }),
    created_at: instante,
    updated_at: instante,
  })
  .openapi('Acudiente');

const camposEscritura = {
  numero_documento: numeroDocumentoSchema.min(3).max(20),
  nombre: z.string().trim().min(1).max(120),
  celular: z.string().trim().max(30).nullish(),
  correo: z.string().trim().toLowerCase().max(160).nullish(),
  es_principal: z.boolean().default(false),
};

export const acudienteCreacionSchema = z.object(camposEscritura).openapi('AcudienteCreacion');

export const acudienteActualizacionSchema = z
  .object({
    numero_documento: camposEscritura.numero_documento.optional(),
    nombre: camposEscritura.nombre.optional(),
    celular: camposEscritura.celular,
    correo: camposEscritura.correo,
    es_principal: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Debe enviar al menos un campo' });
