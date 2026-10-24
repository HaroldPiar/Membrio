/**
 * Esquemas wire de archivos (spec §10).
 *
 * El API no recibe binarios: devuelve URLs firmadas. La ruta del objeto
 * SIEMPRE lleva el tenant por prefijo: {organizacion_id}/{tipo}/{uuid}.{ext},
 * y la base guarda esa ruta (no una URL pública).
 */
import { z } from '@hono/zod-openapi';

export const TIPOS_ARCHIVO = ['comprobante', 'documento'] as const;

/** Tipos MIME aceptados para el MVP (§10; supuesto 6 de §16). */
export const MIME_ACEPTADOS = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const;

export const TAMANO_MAXIMO_BYTES = 10 * 1024 * 1024; // 10 MB (§10)

export const subidaArchivoSchema = z
  .object({
    tipo: z.enum(TIPOS_ARCHIVO).openapi({ example: 'comprobante' }),
    contenido_tipo: z
      .enum(Object.keys(MIME_ACEPTADOS) as [string, ...string[]])
      .openapi({ example: 'application/pdf' }),
    tamano_bytes: z
      .number()
      .int()
      .min(1)
      .max(TAMANO_MAXIMO_BYTES, `El tamaño máximo por archivo es ${TAMANO_MAXIMO_BYTES} bytes (10 MB)`)
      .openapi({ example: 102400 }),
  })
  .openapi('SubidaArchivo');

export const urlFirmadaSchema = z
  .object({
    ruta: z.string().openapi({
      example: '3f2a.../comprobante/9c1b....pdf',
      description: 'Ruta del objeto a guardar en la base (prefijo = organizacion_id)',
    }),
    url: z.string().openapi({
      example: 'http://localhost:3000/api/v1/archivos/local/subida?ruta=...&firma=...',
      description: 'URL firmada de corta duración',
    }),
    metodo: z.enum(['PUT', 'GET']).openapi({ example: 'PUT' }),
    expira_en: z.iso.datetime().openapi({ example: '2026-10-24T15:00:00.000Z' }),
    content_type: z.enum(Object.keys(MIME_ACEPTADOS) as [string, ...string[]]).nullable(),
    tamano_max_bytes: z.number().openapi({ example: 10485760 }),
  })
  .openapi('UrlFirmada');

export const lecturaArchivoSchema = z
  .object({
    ruta: z.string().trim().min(3).max(500).openapi({
      example: '3f2a.../comprobante/9c1b....pdf',
      description: 'Ruta de objeto almacenada (debe pertenecer a la organización de la sesión)',
    }),
  })
  .openapi('LecturaArchivo');
