/**
 * Formateo de dinero para MOSTRAR (Spec del cliente §5, decisión "Dinero").
 *
 * Los montos llegan de la API como cadenas decimales (numeric(12,2)) y aquí
 * nunca se calculan: Intl.NumberFormat v3 acepta el string directamente, así
 * que no hay paso por `number` ni pérdida de precisión. COP tiene 0 dígitos
 * fraccionarios, por eso '150000.00' se ve como '$ 150.000'.
 *
 * OJO: Intl NO valida la entrada — con basura devuelve '$ NaN' y con '' pinta
 * '$ 0' (probado). Para dinero eso es inaceptable, así que el string se valida
 * ANTES y un valor no decimal lanza TypeError: mejor romper en desarrollo que
 * mostrar un monto falso.
 */
const formateadorCOP = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
});

// La v3 de Intl (ES2023) acepta strings en .format() y Node/modernos navegadores
// lo implementan (probado), pero las librerías de tipos de TS aún solo declaran
// number | bigint: declaramos el overload que existe en el runtime.
declare global {
  namespace Intl {
    interface NumberFormat {
      format(valor: string): string;
    }
  }
}

/** ¿La cadena es un decimal válido de los que produce la API? */
export function esDecimal(valor: string): boolean {
  return /^-?\d+(\.\d+)?$/.test(valor);
}

/** '150000.00' → '$ 150.000' · '-15000.00' → '-$ 15.000' (separador: NBSP). */
export function formatearDinero(valor: string): string {
  if (!esDecimal(valor)) {
    throw new TypeError(`formatearDinero: '${valor}' no es un decimal de la API`);
  }
  return formateadorCOP.format(valor);
}

const formateadorFechaUTC = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'medium',
  timeZone: 'UTC',
});
const formateadorInstanteZona = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'America/Bogota',
});

/**
 * '2026-10-25' → '25 oct 2026'. Es un CALENDARIO (no un instante): se ancla a
 * medianoche UTC para que la zona de negocio no lo corra al día anterior.
 */
export function formatearFecha(fecha: string): string {
  const dia = new Date(`${fecha}T00:00:00Z`);
  return Number.isNaN(dia.getTime()) ? '—' : formateadorFechaUTC.format(dia);
}

/** '2026-10-25T10:30:00.000Z' → '25 oct 2026, 5:30 a. m.' (zona de negocio). */
export function formatearInstante(instante: string): string {
  const momento = new Date(instante);
  return Number.isNaN(momento.getTime()) ? '—' : formateadorInstanteZona.format(momento);
}
