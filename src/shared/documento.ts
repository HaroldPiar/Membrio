/**
 * Esquemas Zod compartidos (front y back) para documentos de identidad.
 *
 * Reglas (ajuste pre-Fase 2):
 *  - Normalización: trim + mayúsculas (el CHECK de la base exige ^[A-Z0-9]+$).
 *  - Formato general alfanumérico: los pasaportes llevan letras.
 *  - Solo dígitos cuando el tipo es CC o TI (spec §7). RC y PPT quedan
 *    flexibles hasta confirmar con Truchas (ver CHECK en db/schema.ts).
 *  - Documento de facturación (pagos): alfanumérico con guion, para aceptar
 *    NIT. No tiene tipo asociado en el snapshot, así que no aplica lo de CC/TI.
 */
import { z } from 'zod';

export const TIPOS_DOCUMENTO = ['TI', 'CC', 'RC', 'PAS', 'PPT'] as const;

export const tipoDocumentoSchema = z.enum(TIPOS_DOCUMENTO);
export type TipoDocumento = z.infer<typeof tipoDocumentoSchema>;

const FORMATO_ALFANUMERICO = /^[A-Z0-9]+$/;
const SOLO_DIGITOS = /^[0-9]+$/;
const FORMATO_FACTURACION = /^[A-Z0-9-]+$/;

const TIPOS_SOLO_DIGITOS: ReadonlySet<TipoDocumento> = new Set<TipoDocumento>(['CC', 'TI']);

/** Número de documento normalizado (trim + mayúsculas) con formato alfanumérico general. */
export const numeroDocumentoSchema = z
  .string()
  .trim()
  .toUpperCase()
  .refine((valor) => FORMATO_ALFANUMERICO.test(valor), {
    message: 'Formato inválido: solo letras mayúsculas y números (sin espacios ni símbolos)',
  });

/** Documento de afiliado o acudiente: valida el par (tipo, número) de forma condicional. */
export const documentoAfiliadoSchema = z
  .object({
    tipoDocumento: tipoDocumentoSchema,
    numeroDocumento: numeroDocumentoSchema,
  })
  .superRefine((documento, ctx) => {
    if (TIPOS_SOLO_DIGITOS.has(documento.tipoDocumento) && !SOLO_DIGITOS.test(documento.numeroDocumento)) {
      ctx.addIssue({
        code: 'custom',
        path: ['numeroDocumento'],
        message: `${documento.tipoDocumento} requiere solo dígitos`,
      });
    }
  });

/**
 * Documento del responsable de pago (snapshot de facturación en pagos).
 * Acepta alfanumérico y guion para cubrir cédulas y NIT.
 */
export const documentoFacturacionSchema = z
  .string()
  .trim()
  .toUpperCase()
  .refine((valor) => FORMATO_FACTURACION.test(valor), {
    message: 'Formato inválido: solo letras mayúsculas, números y guion',
  });
