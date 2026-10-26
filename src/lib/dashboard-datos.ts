/**
 * Transformaciones puras del dashboard (Spec del cliente §4.2) — sin React ni
 * Recharts, para poder testearlas con Vitest.
 *
 * Regla de dinero (Spec del cliente §5): los montos NUNCA se calculan con
 * `number`. Aquí solo se derivan dos cosas permitidas:
 *  - `magnitud`: escala la GEOMETRÍA de las barras (Number sobre el string);
 *    cualquier monto que se muestre (tooltip, tarjetas) se formatea desde el
 *    string original con `formatearDinero`.
 *  - Orden de morosos en CENTAVOS ENTEROS con `centavosDesdeCadena` (exacto,
 *    misma convención aritmética del backend, spec técnico §6): jamás ordenar
 *    strings decimales ni flotantes.
 */
import type { z } from '@hono/zod-openapi';

import { centavosDesdeCadena } from '../shared/dinero';
import type {
  morosidadSchema,
  recaudoSchema,
  resumenDashboardSchema,
} from '../shared/dashboard';

export type ResumenDashboard = z.infer<typeof resumenDashboardSchema>;
export type MorosidadDashboard = z.infer<typeof morosidadSchema>;
export type RecaudoDashboard = z.infer<typeof recaudoSchema>;
export type Deudor = MorosidadDashboard['deudores'][number];

export type EstadoAfiliado = 'al_dia' | 'por_vencer' | 'en_mora';

const formateadorCorto = new Intl.DateTimeFormat('es-CO', { month: 'short', timeZone: 'UTC' });
const formateadorLargo = new Intl.DateTimeFormat('es-CO', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

/** '2026-09' → Date anclado al día 1 en UTC (clave de mes, sin zonas raras). */
function fechaDeClave(clave: string): Date {
  return new Date(`${clave}-01T00:00:00Z`);
}

/** '2026-09' → 'sept.' (etiqueta corta del eje X). */
export function etiquetaMes(clave: string): string {
  return formateadorCorto.format(fechaDeClave(clave));
}

/** '2026-09' → 'septiembre de 2026' (texto del tooltip). */
export function etiquetaMesLarga(clave: string): string {
  return formateadorLargo.format(fechaDeClave(clave));
}

/** '2026-09' → 'sept' (chip compacto de meses adeudados, sin el punto). */
export function etiquetaMesChip(clave: string): string {
  return etiquetaMes(clave).replace(/\.$/, '');
}

export type PuntoRecaudo = {
  /** 'AAAA-MM' crudo del wire. */
  mes: string;
  /** 'sept.' para el eje X. */
  etiqueta: string;
  /** Monto como STRING decimal — el que se formatea en el tooltip. */
  total: string;
  /** Solo escala la altura de la barra; no es un monto reportado. */
  magnitud: number;
};

/** Serie de recaudo por mes para el gráfico de barras (los 12 meses del wire). */
export function serieRecaudo(meses: RecaudoDashboard['meses']): PuntoRecaudo[] {
  return meses.map(({ mes, total }) => ({
    mes,
    etiqueta: etiquetaMes(mes),
    total,
    magnitud: Number(total),
  }));
}

export type PorcionEstado = { estado: EstadoAfiliado; cantidad: number };

/**
 * Sectores de la dona por estado de pago. Los conteos 0 se omiten: una dona
 * sin porción aporta ruido, no información.
 */
export function porcionesEstados(afiliados: ResumenDashboard['afiliados']): PorcionEstado[] {
  const crudo: PorcionEstado[] = [
    { estado: 'al_dia', cantidad: afiliados.al_dia },
    { estado: 'por_vencer', cantidad: afiliados.por_vencer },
    { estado: 'en_mora', cantidad: afiliados.en_mora },
  ];
  return crudo.filter((porcion) => porcion.cantidad > 0);
}

export type PorcionConPorcentaje = PorcionEstado & { porcentaje: number };

/**
 * Porcentajes para la leyenda de la dona. Son CONTEOS (no dinero): `number`
 * está permitido. Redondeo a entero — la leyenda es informativa, no un monto.
 */
export function porcentajes(porciones: readonly PorcionEstado[]): PorcionConPorcentaje[] {
  const total = porciones.reduce((suma, porcion) => suma + porcion.cantidad, 0);
  if (total === 0) return [];
  return porciones.map((porcion) => ({
    ...porcion,
    porcentaje: Math.round((porcion.cantidad / total) * 100),
  }));
}

/**
 * Top N deudores ordenado de MAYOR a MENOR deuda en centavos enteros (exacto).
 * El orden del endpoint no está garantizado, así que se ordena aquí — siempre
 * se muestra `valor_adeudado` original con `formatearDinero`.
 */
export function topMorosos(deudores: readonly Deudor[], cantidad: number): Deudor[] {
  return [...deudores]
    .sort(
      (a, b) => centavosDesdeCadena(b.valor_adeudado) - centavosDesdeCadena(a.valor_adeudado),
    )
    .slice(0, cantidad);
}
