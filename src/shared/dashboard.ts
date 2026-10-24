/**
 * Esquemas wire de dashboard (spec §8.4).
 * Los montos salen como cadenas decimales; la cartera se valora con
 * `planes.valor_mensualidad * (1 - descuento)` en aritmética de centavos.
 */
import { z } from '@hono/zod-openapi';

import { fecha, idSchema } from './catalogos';
import { dineroSchema } from './dinero';

export const resumenDashboardSchema = z
  .object({
    afiliados: z.object({
      total: z.number(),
      activos: z.number(),
      retirados: z.number(),
      al_dia: z.number(),
      por_vencer: z.number(),
      en_mora: z.number(),
    }),
    pagos: z.object({
      pendientes: z.number().openapi({ description: 'Pagos pendientes de verificación' }),
    }),
    recaudo_mes_actual: dineroSchema,
  })
  .openapi('DashboardResumen');

export const morosidadSchema = z
  .object({
    fecha: fecha.openapi({ description: 'Fecha de cálculo (zona America/Bogota)' }),
    total_cartera: dineroSchema.openapi({
      description: 'Suma de lo adeudado por los afiliados en mora',
    }),
    deudores: z.array(
      z.object({
        afiliado_id: idSchema,
        nombre: z.string(),
        plan_id: idSchema,
        categoria_id: idSchema,
        meses_adeudados: z.array(z.string().openapi({ example: '2026-03' })),
        valor_adeudado: dineroSchema,
      }),
    ),
  })
  .openapi('DashboardMorosidad');

export const recaudoSchema = z
  .object({
    meses: z.array(
      z.object({
        mes: z.string().openapi({ example: '2026-09', description: 'AAAA-MM (fecha_cobertura)' }),
        total: dineroSchema,
      }),
    ),
  })
  .openapi('DashboardRecaudo');
