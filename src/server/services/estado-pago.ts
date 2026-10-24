/**
 * Estado de pago calculado (spec §8.3): "al_dia" | "por_vencer" | "en_mora".
 *
 * NO se almacena (decisión 7 del §15): se deriva en cada consulta a partir de
 * los meses con pago VERIFICADO, la fecha actual en America/Bogota,
 * fecha_ingreso y activo. Servicio puro: sin DB ni HTTP, testeable con Vitest.
 *
 * Reglas del MVP — SUPUESTOS pendientes de validar con Truchas (§16):
 *  - Solo se evalúan afiliados activos; un retirado devuelve null.
 *  - Solo cuentan líneas de MENSUALIDAD verificadas (la matrícula es anual,
 *    enero no es facturable, no afecta el conteo mensual).
 *  - Meses facturables y días del §16.1/§16.2 viven en config/estado-pago.ts.
 *  - "En mora": existe al menos un mes facturable EXIGIBLE sin pago verificado.
 *    Exigible = mes anterior al actual, o el mes actual tras el día límite.
 *  - Mes de ingreso: si el afiliado ingresó DESPUÉS del día límite, ese mes
 *    no es exigible nunca (su plazo de pago ya había pasado al ingresar);
 *    se evalúa a partir del mes siguiente.
 *  - "Por vencer": sin adeudos exigibles, mes actual facturable sin pagar y
 *    faltan entre 0 y N días para el día límite.
 *  - Pagos adelantados quedan cubiertos automáticamente: la evaluación es
 *    por mes, no por pago (§8.3 último párrafo).
 */
import {
  DIA_LIMITE_PAGO,
  MESES_FACTURABLES,
  VENTANA_POR_VENCER_DIAS,
  ZONA_HORARIA_NEGOCIO,
} from '../config/estado-pago';

export type EstadoPagoCalculado = 'al_dia' | 'por_vencer' | 'en_mora';

export type ResultadoEstado = {
  estado: EstadoPagoCalculado;
  /** Fecha (AAAA-MM-DD) en la que se evaluó, en zona de negocio. */
  fecha: string;
  /** Meses exigibles sin pago verificado ('AAAA-MM'); vacío salvo en mora. */
  mesesAdeudados: string[];
  /** Días restantes para el día límite del mes actual; null si ya pasó. */
  diasParaLimite: number | null;
};

export type AfiliadoAEvaluar = {
  /** AAAA-MM-DD (columna date). */
  fechaIngreso: string;
  activo: boolean;
  /** Meses 'AAAA-MM' con línea de mensualidad en pago VERIFICADO. */
  mesesPagados: ReadonlySet<string>;
};

/** Fecha AAAA-MM-DD de un instante en la zona de negocio. */
export function hoyEnZona(hoy: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA_NEGOCIO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(hoy);
}

/** Partes de una fecha AAAA-MM-DD ya validada por la base/Zod. */
function parsearFecha(fecha: string): { anio: number; mes: number; dia: number } {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  return { anio: anio ?? 0, mes: mes ?? 1, dia: dia ?? 1 };
}

function partesFechaEnZona(hoy: Date): { anio: number; mes: number; dia: number } {
  return parsearFecha(hoyEnZona(hoy));
}

export function claveMes(anio: number, mes: number): string {
  return `${anio}-${String(mes).padStart(2, '0')}`;
}

export function calcularEstadoPago(afiliado: AfiliadoAEvaluar, hoy: Date): ResultadoEstado | null {
  if (!afiliado.activo) return null;

  const { anio, mes, dia } = partesFechaEnZona(hoy);
  const { anio: anioIngreso, mes: mesIngreso, dia: diaIngreso } = parsearFecha(afiliado.fechaIngreso);
  // Ingresó después del día límite de su mes: ese mes nunca es exigible.
  const mesIngresoNoExigible = diaIngreso > DIA_LIMITE_PAGO;

  const esFacturable = (m: number): boolean =>
    (MESES_FACTURABLES as readonly number[]).includes(m);

  const mesesAdeudados: string[] = [];
  let mesActualSinPagar = false;

  let a = anioIngreso;
  let m = mesIngreso;
  while (a < anio || (a === anio && m <= mes)) {
    if (esFacturable(m) && !afiliado.mesesPagados.has(claveMes(a, m))) {
      const esMesDeIngreso = a === anioIngreso && m === mesIngreso;
      const noExigible = esMesDeIngreso && mesIngresoNoExigible;
      const esActual = a === anio && m === mes;
      if (esActual) {
        if (!noExigible && dia > DIA_LIMITE_PAGO) {
          mesesAdeudados.push(claveMes(a, m));
        } else if (!noExigible) {
          mesActualSinPagar = true;
        }
      } else if (!noExigible) {
        mesesAdeudados.push(claveMes(a, m));
      }
    }
    m += 1;
    if (m > 12) {
      m = 1;
      a += 1;
    }
  }

  const diasParaLimite = dia <= DIA_LIMITE_PAGO ? DIA_LIMITE_PAGO - dia : null;
  const fecha = hoyEnZona(hoy);

  if (mesesAdeudados.length > 0) {
    return { estado: 'en_mora', fecha, mesesAdeudados, diasParaLimite };
  }
  if (
    mesActualSinPagar &&
    diasParaLimite !== null &&
    diasParaLimite <= VENTANA_POR_VENCER_DIAS
  ) {
    return { estado: 'por_vencer', fecha, mesesAdeudados: [], diasParaLimite };
  }
  return { estado: 'al_dia', fecha, mesesAdeudados: [], diasParaLimite };
}
