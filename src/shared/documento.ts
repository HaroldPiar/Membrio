/**
 * Esquemas Zod compartidos (front y back) para documentos de identidad.
 *
 * Reglas (ajuste pre-Fase 2 + corrección de snapshot de facturación):
 *  - Normalización: trim + mayúsculas (el CHECK de la base exige ^[A-Z0-9]+$).
 *  - Formato general alfanumérico: los pasaportes llevan letras.
 *  - Solo dígitos cuando el tipo es CC o TI (spec §7). RC y PPT quedan
 *    flexibles hasta confirmar con Truchas (ver CHECK en db/schema.ts).
 *  - Documento de facturación (pagos): snapshot con tipo de documento propio
 *    que agrega NIT (la factura electrónica distingue cédula de NIT, spec §8.1).
 *    El número acepta alfanumérico con guion para cubrir NIT (900123456-1);
 *    solo dígitos cuando el tipo es CC o TI.
 */
import { z } from 'zod';

/** Tipos de identidad de una persona (formulario de Truchas). */
export const TIPOS_DOCUMENTO = ['TI', 'CC', 'RC', 'PAS', 'PPT'] as const;
/** Para facturación se agrega NIT (empresa). */
export const TIPOS_DOCUMENTO_FACTURACION = [...TIPOS_DOCUMENTO, 'NIT'] as const;

export const tipoDocumentoSchema = z.enum(TIPOS_DOCUMENTO);
export type TipoDocumento = z.infer<typeof tipoDocumentoSchema>;

export const tipoDocumentoFacturacionSchema = z.enum(TIPOS_DOCUMENTO_FACTURACION);
export type TipoDocumentoFacturacion = z.infer<typeof tipoDocumentoFacturacionSchema>;

const FORMATO_ALFANUMERICO = /^[A-Z0-9]+$/;
const SOLO_DIGITOS = /^[0-9]+$/;
const FORMATO_FACTURACION = /^[A-Z0-9-]+$/;

const TIPOS_SOLO_DIGITOS: ReadonlySet<string> = new Set(['CC', 'TI']);

/** Número de documento normalizado (trim + mayúsculas) con formato alfanumérico general. */
export const numeroDocumentoSchema = z
  .string()
  .trim()
  .toUpperCase()
  .refine((valor) => FORMATO_ALFANUMERICO.test(valor), {
    message: 'Formato inválido: solo letras mayúsculas y números (sin espacios ni símbolos)',
  });

/** Número de documento de facturación: como el general pero permite guion (NIT). */
export const numeroDocumentoFacturacionSchema = z
  .string()
  .trim()
  .toUpperCase()
  .refine((valor) => FORMATO_FACTURACION.test(valor), {
    message: 'Formato inválido: solo letras mayúsculas, números y guion',
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
 * Documento del responsable de pago (snapshot de facturación en pagos):
 * par (tipo, número) con condicional CC/TI, igual que afiliados.
 * El tipo incluye NIT (TIPOS_DOCUMENTO_FACTURACION).
 */
export const documentoFacturacionSchema = z
  .object({
    tipoDocumento: tipoDocumentoFacturacionSchema,
    numeroDocumento: numeroDocumentoFacturacionSchema,
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
