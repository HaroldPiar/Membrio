/**
 * Dinero en la API: SIEMPRE cadenas decimales, nunca `number` (spec §6 y
 * decisión 9 del §15 — el punto flotante no sirve para dinero).
 *
 * Toda la aritmética de montos en services se hace en CENTAVOS enteros
 * (enteros exactos en Number, sin errores de redondeo): parsear con
 * centavosDesdeCadena y formatear con centavosACadena.
 */
import { z } from '@hono/zod-openapi';

/** Decimal no negativo con hasta 2 decimales, max 10 dígitos enteros (numeric(12,2)). */
const FORMATO_DINERO = /^(?:0|[1-9][0-9]{0,9})(?:\.[0-9]{1,2})?$/;

export const dineroSchema = z
  .string()
  .trim()
  .refine((v) => FORMATO_DINERO.test(v), {
    message: 'Monto inválido: debe ser un decimal no negativo con máximo 2 decimales (ej. "150000.00")',
  })
  .openapi({
    example: '150000.00',
    description: 'Monto como cadena decimal (nunca número flotante)',
  });

/** '"74000.00" → 7400000 centavos'. Asume formato ya validado por dineroSchema. */
export function centavosDesdeCadena(valor: string): number {
  const [enteros, decimales = ''] = valor.split('.');
  return Number(enteros) * 100 + Number(decimales.padEnd(2, '0'));
}

/** '7400000 centavos → "74000.00"'. */
export function centavosACadena(centavos: number): string {
  const signo = centavos < 0 ? '-' : '';
  const abs = Math.abs(Math.round(centavos));
  const enteros = Math.floor(abs / 100);
  const decimales = String(abs % 100).padStart(2, '0');
  return `${signo}${enteros}.${decimales}`;
}
