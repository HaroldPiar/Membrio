/**
 * Esquemas wire de usuarios (spec §9: CRUD, solo admin).
 * Nota: `correo` es único GLOBALMENTE en la base (constraint de Fase 1):
 * crear un correo ya usado por otra organización responde 409.
 */
import { z } from '@hono/zod-openapi';

import { idSchema, instante } from './catalogos';

export const rolSchema = z.enum(['admin', 'operador']).openapi({
  description: 'Roles iniciales de la matriz de permisos (spec §4)',
  example: 'admin',
});

export const usuarioSchema = z
  .object({
    id: idSchema,
    correo: z.email().openapi({ example: 'admin@truchas.test' }),
    nombre: z.string().openapi({ example: 'María Pérez' }),
    rol: rolSchema,
    activo: z.boolean(),
    created_at: instante,
    updated_at: instante,
  })
  .openapi('Usuario');

export const usuarioCreacionSchema = z
  .object({
    correo: z.email().openapi({ example: 'operador2@truchas.test' }),
    nombre: z.string().trim().min(1).max(120),
    rol: rolSchema,
  })
  .openapi('UsuarioCreacion');

export const usuarioActualizacionSchema = z
  .object({
    nombre: z.string().trim().min(1).max(120).optional(),
    rol: rolSchema.optional(),
    activo: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Debe enviar al menos un campo' });
