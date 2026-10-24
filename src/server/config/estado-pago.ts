/**
 * Constantes del estado de pago (spec §8.3).
 *
 * Son SUPUESTOS pendientes de validar con Truchas (§16.1 y §16.2):
 *  - meses facturables: febrero a diciembre (enero no se cobra);
 *  - día límite de pago: día 5;
 *  - ventana de aviso "Por vencer": 5 días antes del día límite;
 *  - zona de negocio: America/Bogota.
 *
 * Módulo SIN dependencia de env: es importable por pruebas unitarias sin
 * configurar DATABASE_URL ni secretos.
 */
export const ZONA_HORARIA_NEGOCIO = 'America/Bogota';

/** 1 = enero … 12 = diciembre. Enero no es facturable para Truchas. */
export const MESES_FACTURABLES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

export const DIA_LIMITE_PAGO = 5;

export const VENTANA_POR_VENCER_DIAS = 5;
