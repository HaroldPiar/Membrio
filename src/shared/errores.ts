/**
 * Forma uniforme de error de la API (spec §9), compartida front y back:
 *   { "error": { "code": "...", "message": "...", "details": [...] } }
 *
 * Códigos que emite la API (no confundir con los SQLSTATE de Postgres,
 * que el servidor traduce a estos códigos y a un status HTTP):
 *  - VALIDACION (400), SESION_INVALIDA (401), USUARIO_INACTIVO (401),
 *    PERMISO_INSUFICIENTE (403), NO_ENCONTRADO (404),
 *    DUPLICADO (409), REFERENCIA_INVALIDA (422), RESTRICCION_VIOLADA (422),
 *    DATO_OBLIGATORIO (422), RUTA_NO_ENCONTRADA (404),
 *    CREDENCIALES_INVALIDAS (401), ERROR_INTERNO (500).
 */
import { z } from '@hono/zod-openapi';

export type RespuestaError = {
  error: {
    code: string;
    message: string;
    details: unknown[];
  };
};

/** Versión OpenAPI de la forma de error (componente #/components/schemas/Error). */
export const respuestaErrorSchema = z
  .object({
    error: z.object({
      code: z.string().openapi({ example: 'NO_ENCONTRADO' }),
      message: z.string().openapi({ example: 'Afiliado no encontrado' }),
      details: z.array(z.unknown()).openapi({
        description: 'Detalles adicionales; vacío salvo en errores de validación',
        examples: [[]],
      }),
    }),
  })
  .openapi('Error');

type StatusConError = 400 | 401 | 403 | 404 | 409 | 422 | 500;

const DESCRIPCIONES: Record<StatusConError, string> = {
  400: 'Validación: datos de entrada inválidos',
  401: 'Sesión ausente, inválida o usuario inactivo',
  403: 'Rol insuficiente para la operación',
  404: 'Recurso inexistente (incluye recursos de otra organización)',
  409: 'Conflicto: registro duplicado o transición de estado no permitida',
  422: 'Violación de integridad o reglas de la base',
  500: 'Error interno sin detalles técnicos',
};

/**
 * Respuestas de error estándar para declarar en rutas OpenAPI (spec §9:
 * "cada endpoint con ejemplos ... y sus errores").
 * Uso: responses: { 200: {...}, ...respuestasError(401, 404) }
 */
export function respuestasError(...codigos: StatusConError[]): Record<
  number,
  { description: string; content: { 'application/json': { schema: typeof respuestaErrorSchema } } }
> {
  const out: Record<
    number,
    { description: string; content: { 'application/json': { schema: typeof respuestaErrorSchema } } }
  > = {};
  for (const codigo of codigos) {
    out[codigo] = {
      description: DESCRIPCIONES[codigo],
      content: { 'application/json': { schema: respuestaErrorSchema } },
    };
  }
  return out;
}
