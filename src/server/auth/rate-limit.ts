/**
 * Limitador de intentos de inicio de sesión fallidos (en memoria; no hay Redis
 * todavía — decisión del MVP: estado efímero por proceso, suficiente para un
 * club con un único API).
 *
 * Reglas (task de login producción): 5 intentos fallidos por clave (correo
 * normalizado + IP) dentro de una ventana de 15 minutos; al exceder → 429
 * `DEMASIADOS_INTENTOS`. La ventana se reinicia con un login exitoso.
 *
 * Task de gestión de usuarios en producción: se suma un limitador por correo
 * SOLAMENTE (sin importar la IP), con un límite más laxo (10 intentos / 15 min) para
 * no penalizar a un usuario legítimo que se equivoca varias veces; ambos → 429
 * `DEMASIADOS_INTENTOS`.
 */

/** Intentos fallidos permitidos por clave dentro de la ventana (login: correo+IP). */
export const LIMITE_INTENTOS_FALLIDOS = 5;

/** Intentos fallidos permitidos por correo dentro de la ventana (login: por correo). */
export const LIMITE_INTENTOS_POR_CORREO_FALLIDOS = 10;

/** Duración de la ventana de intentos fallidos (15 min). */
export const VENTANA_INTENTOS_MS = 15 * 60 * 1000;

export type OpcionesLimitador = {
  limite?: number;
  ventanaMs?: number;
};

export type LimitadorIntentos = {
  /** ¿La clave puede intentar? (dentro de la ventana y bajo el límite). */
  puedeIntentar(clave: string): boolean;
  /** Registra un intento fallido (abre ventana / incrementa conteo). */
  registrarFallo(clave: string): void;
  /** Reinicia la clave (tras un login exitoso) o todas (no-op con undefined). */
  reiniciar(clave?: string): void;
};

export function crearLimitadorIntentos(opciones: OpcionesLimitador = {}): LimitadorIntentos {
  const limite = opciones.limite ?? LIMITE_INTENTOS_FALLIDOS;
  const ventanaMs = opciones.ventanaMs ?? VENTANA_INTENTOS_MS;
  type Entrada = { fallidos: number; ventanaInicio: number };
  const tabla = new Map<string, Entrada>;

  const ahora = (): number => Date.now();

  const dentroDeLaVentana = (entrada: Entrada): boolean =>
    ahora() - entrada.ventanaInicio < ventanaMs;

  const limpiar = (): void => {
    const corte = ahora() - ventanaMs;
    for (const [clave, entrada] of tabla) {
      if (entrada.ventanaInicio <= corte) {
        tabla.delete(clave);
      }
    }
  };

  return {
    puedeIntentar(clave: string): boolean {
      limpiar();
      const entrada = tabla.get(clave);
      if (!entrada) return true;
      if (!dentroDeLaVentana(entrada)) {
        tabla.delete(clave);
        return true;
      }
      return entrada.fallidos < limite;
    },

    registrarFallo(clave: string): void {
      limpiar();
      const entrada = tabla.get(clave);
      if (!entrada || !dentroDeLaVentana(entrada)) {
        tabla.set(clave, { fallidos: 1, ventanaInicio: ahora() });
        return;
      }
      entrada.fallidos += 1;
    },

    reiniciar(clave?: string): void {
      if (clave === undefined) {
        tabla.clear();
        return;
      }
      tabla.delete(clave);
    },
  };
}
