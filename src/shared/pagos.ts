/**
 * Esquemas wire de pagos (spec §8.1 y §9).
 *
 * El body de alta es PLANO en paridad con las columnas de `pagos`
 * (factura_* es el snapshot de facturación y no cambia después).
 * Validaciones de forma en Zod (capa routes, spec §7):
 *  - fecha_cobertura siempre día 1;
 *  - matrícula solo con fecha_cobertura = 1 de enero (§8.2);
 *  - sin líneas duplicadas (afiliado, concepto, fecha) dentro del request;
 *  - monto_total == suma de las líneas.
 * La pertenencia al tenant de cada afiliado y los duplicados contra la base
 * se validan en el service (requieren consulta).
 */
import { z } from '@hono/zod-openapi';

import { fecha, idSchema, instante } from './catalogos';
import { dineroSchema } from './dinero';
import { paginacionQuerySchema } from './paginacion';
import { TIPOS_DOCUMENTO_FACTURACION, validarFormatoDocumento } from './documento';

export const conceptoSchema = z.enum(['mensualidad', 'matricula']).openapi({
  example: 'mensualidad',
  description: 'matricula implica fecha_cobertura = 1 de enero del año (§8.2)',
});

export const estadoPagoSchema = z
  .enum(['pendiente', 'verificado', 'rechazado'])
  .openapi({ example: 'pendiente' });

export const lineaPagoSchema = z
  .object({
    id: idSchema,
    afiliado_id: idSchema,
    concepto: conceptoSchema,
    fecha_cobertura: fecha,
    monto: dineroSchema,
  })
  .openapi('LineaPago');

export const pagoSchema = z
  .object({
    id: idSchema,
    monto_total: dineroSchema,
    estado: estadoPagoSchema,
    factura_tipo_documento: z.enum(TIPOS_DOCUMENTO_FACTURACION),
    factura_documento: z.string().openapi({ example: '900123456-1' }),
    factura_nombre: z.string().openapi({ example: 'Acme S.A.S.' }),
    factura_celular: z.string().nullable(),
    factura_correo: z.string().nullable(),
    observaciones: z.string().nullable(),
    url_comprobante: z.string().nullable().openapi({
      description: 'Ruta de objeto en Storage (no es URL pública, §10)',
    }),
    revisado_por: idSchema.nullable(),
    revisado_en: instante.nullable(),
    created_at: instante,
    updated_at: instante,
    lineas: z.array(lineaPagoSchema),
  })
  .openapi('Pago');

/** Resumen para listados (sin líneas). */
export const pagoResumenSchema = pagoSchema.omit({ lineas: true }).openapi('PagoResumen');

const lineaCreacionSchema = z.object({
  afiliado_id: idSchema,
  concepto: conceptoSchema,
  fecha_cobertura: fecha,
  monto: dineroSchema,
});

export const pagoCreacionSchema = z
  .object({
    monto_total: dineroSchema,
    factura_tipo_documento: z.enum(TIPOS_DOCUMENTO_FACTURACION),
    factura_documento: z.string().trim().toUpperCase().min(3).max(20),
    factura_nombre: z.string().trim().min(1).max(160),
    factura_celular: z.string().trim().max(30).nullish(),
    factura_correo: z.string().trim().toLowerCase().max(160).nullish(),
    observaciones: z.string().trim().max(1000).nullish(),
    url_comprobante: z.string().trim().max(500).nullish(),
    lineas: z.array(lineaCreacionSchema).min(1, 'El pago debe tener al menos una línea').max(500),
  })
  .superRefine((pago, ctx) => {
    // Documento de facturación: formato del par (incluye guion para NIT).
    validarFormatoDocumento(pago.factura_tipo_documento, pago.factura_documento, ctx, ['factura_documento'], {
      conGuion: true,
    });

    let sumaCentavos = 0;
    const vistas = new Set<string>();
    pago.lineas.forEach((linea, i) => {
      const ruta = ['lineas', i] as (string | number)[];

      // Día 1 (CHECK de la base, anticipado en la API — spec §7).
      const [, mes, dia] = linea.fecha_cobertura.split('-').map(Number);
      if (dia !== 1) {
        ctx.addIssue({
          code: 'custom',
          path: [...ruta, 'fecha_cobertura'],
          message: 'fecha_cobertura debe ser siempre día 1 del mes',
        });
      }
      // Matrícula: 1 de enero del año correspondiente (§8.2).
      if (linea.concepto === 'matricula' && mes !== 1) {
        ctx.addIssue({
          code: 'custom',
          path: [...ruta, 'fecha_cobertura'],
          message: 'Una línea de matrícula debe tener fecha_cobertura = 1 de enero del año',
        });
      }

      const llave = `${linea.afiliado_id}|${linea.concepto}|${linea.fecha_cobertura}`;
      if (vistas.has(llave)) {
        ctx.addIssue({
          code: 'custom',
          path: ruta,
          message: 'Línea duplicada: mismo afiliado, concepto y fecha de cobertura',
        });
      }
      vistas.add(llave);

      const [enteros, dec = ''] = linea.monto.split('.');
      sumaCentavos += Number(enteros) * 100 + Number(dec.padEnd(2, '0'));
    });

    // monto_total == suma de líneas, en centavos exactos (sin flotantes).
    const [totEnt, totDec = ''] = pago.monto_total.split('.');
    const totalCentavos = Number(totEnt) * 100 + Number(totDec.padEnd(2, '0'));
    if (totalCentavos !== sumaCentavos) {
      ctx.addIssue({
        code: 'custom',
        path: ['monto_total'],
        message: `monto_total debe ser igual a la suma de las líneas (suma real: ${(sumaCentavos / 100).toFixed(2)})`,
      });
    }
  })
  .openapi('PagoCreacion');

export const pagoActualizacionEstadoSchema = z
  .object({
    estado: z.enum(['verificado', 'rechazado']).openapi({
      description: 'verificado aprueba el comprobante; rechazado libera sus líneas de detalle (§8.1.5)',
      example: 'verificado',
    }),
  })
  .openapi('PagoEstado');

export const pagoFiltrosSchema = paginacionQuerySchema.extend({
  estado: estadoPagoSchema.optional(),
  afiliado: idSchema.optional(),
  desde: fecha.optional().openapi({ description: 'Filtrar por fecha de creación >= desde' }),
  hasta: fecha.optional().openapi({ description: 'Filtrar por fecha de creación <= hasta' }),
});
