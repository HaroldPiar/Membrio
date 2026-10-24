/**
 * Servicio de dashboard (spec §8.4): agregaciones sobre pagos, afiliados y
 * el estado de pago calculado. Aritmética de cartera en CENTAVOS enteros
 * (nunca flotantes — spec §6).
 *
 * cartera: meses adeudados × valor_mensualidad × (1 - descuento), con
 * descuento en diezmilésimas (numeric(5,4)) — enteros exactos hasta 2^53.
 */
import type { ContextoTenant } from '../middleware/auth';
import * as reposAfiliados from '../repositories/afiliados';
import { contarPagosPendientes, mesesPagadosVerificados, recaudoPorMes } from '../repositories/pagos';
import { centavosACadena, centavosDesdeCadena } from '../../shared/dinero';
import { claveMes, calcularEstadoPago, hoyEnZona } from './estado-pago';

function primerDiaMes(anio: number, mes: number): string {
  return `${anio}-${String(mes).padStart(2, '0')}-01`;
}

/** Meses 'AAAA-MM' de los últimos `cantidad` meses hasta el mes actual (zona de negocio). */
function ultimosMeses(cantidad: number, hoy: Date): string[] {
  const [anio, mes] = hoyEnZona(hoy).split('-').map(Number);
  const meses: string[] = [];
  for (let i = cantidad - 1; i >= 0; i -= 1) {
    const total = (anio ?? 0) * 12 + (mes ?? 1) - 1 - i;
    meses.push(claveMes(Math.floor(total / 12), (total % 12) + 1));
  }
  return meses;
}

/** Valor mensual de un plan con descuento, en centavos exactos. */
function valorMensualCentavos(valorMensualidad: string, descuento: string): number {
  const base = centavosDesdeCadena(valorMensualidad);
  const diezmil = Math.round(Number(descuento) * 10000); // '0.1000' → 1000
  return Math.round((base * (10000 - diezmil)) / 10000);
}

export async function resumenDashboard(ctx: ContextoTenant, hoy: Date = new Date()) {
  const [conteos, activos, mesesPagados, pendientes, recaudo] = await Promise.all([
    reposAfiliados.contarPorActivo(ctx),
    reposAfiliados.listarActivosParaEstado(ctx),
    mesesPagadosVerificados(ctx),
    contarPagosPendientes(ctx),
    recaudoPorMes(ctx, primerDiaMes(...partirFecha(hoyEnZona(hoy)))),
  ]);

  let alDia = 0;
  let porVencer = 0;
  let enMora = 0;
  for (const afiliado of activos) {
    const estado = calcularEstadoPago(
      {
        fechaIngreso: afiliado.fechaIngreso,
        activo: true,
        mesesPagados: mesesPagados.get(afiliado.id) ?? new Set<string>(),
      },
      hoy,
    );
    if (estado?.estado === 'al_dia') alDia += 1;
    else if (estado?.estado === 'por_vencer') porVencer += 1;
    else if (estado?.estado === 'en_mora') enMora += 1;
  }

  const mesActual = claveMes(...partirFecha(hoyEnZona(hoy)));
  const recaudoMes = recaudo.find((r) => r.mes === mesActual)?.total ?? '0.00';

  return {
    afiliados: {
      total: conteos.activos + conteos.retirados,
      activos: conteos.activos,
      retirados: conteos.retirados,
      al_dia: alDia,
      por_vencer: porVencer,
      en_mora: enMora,
    },
    pagos: { pendientes },
    recaudo_mes_actual: recaudoMes,
  };
}

function partirFecha(fecha: string): [number, number] {
  const [anio, mes] = fecha.split('-').map(Number);
  return [anio ?? 0, mes ?? 1];
}

export async function morosidadDashboard(ctx: ContextoTenant, hoy: Date = new Date()) {
  const [activos, mesesPagados] = await Promise.all([
    reposAfiliados.listarActivosParaEstado(ctx),
    mesesPagadosVerificados(ctx),
  ]);

  const deudores: {
    afiliado_id: string;
    nombre: string;
    plan_id: string;
    categoria_id: string;
    meses_adeudados: string[];
    valor_adeudado: string;
  }[] = [];
  let totalCartera = 0;

  for (const afiliado of activos) {
    const estado = calcularEstadoPago(
      {
        fechaIngreso: afiliado.fechaIngreso,
        activo: true,
        mesesPagados: mesesPagados.get(afiliado.id) ?? new Set<string>(),
      },
      hoy,
    );
    if (!estado || estado.mesesAdeudados.length === 0) continue;

    const porMes = valorMensualCentavos(afiliado.valorMensualidad, afiliado.descuento);
    const valor = porMes * estado.mesesAdeudados.length;
    totalCartera += valor;
    deudores.push({
      afiliado_id: afiliado.id,
      nombre: afiliado.nombre,
      plan_id: afiliado.planId,
      categoria_id: afiliado.categoriaId,
      meses_adeudados: estado.mesesAdeudados,
      valor_adeudado: centavosACadena(valor),
    });
  }

  return {
    fecha: hoyEnZona(hoy),
    total_cartera: centavosACadena(totalCartera),
    deudores,
  };
}

export async function recaudoDashboard(ctx: ContextoTenant, hoy: Date = new Date()) {
  const meses = ultimosMeses(12, hoy);
  const filas = await recaudoPorMes(ctx, `${meses[0] ?? hoyEnZona(hoy).slice(0, 7)}-01`);
  const porMes = new Map(filas.map((f) => [f.mes, f.total]));
  return {
    meses: meses.map((mes) => ({ mes, total: porMes.get(mes) ?? '0.00' })),
  };
}
