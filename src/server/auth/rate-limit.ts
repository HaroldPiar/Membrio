/**
 * Limitador de intentos de inicio de sesión fallidos (en memoria; no hay Redis
 * todavía — decisión del MVP: estado efímero por proceso, suficiente para un
 * club con un único API).
 *
 * Reglas (task de login producción): 5 intentos fallidos por clave (correo
 * normalizado + IP) dentro de una ventana de 15 minutos; al exceder → 429
 * `DEMASIADOS_INTENTOS`. La ventana se reinicia con un login exitoso.
 */

/** Intentos fallidos permitidos por clave dentro de la ventana. */
export const LIMITE_INTENTOS_FALLIDOS = 5;

/** Duración de la ventana de intentos fallidos (15 min). */
export const VENTANA_INTENTOS_MS = 15 * 60 * 1000;

export type LimitadorIntentos = {
  /** ¿La clave puede intentar? (dentro de la ventana y bajo el límite). */
  puedeIntentar(clave: string): boolean;
  /** Registra un intento fallido (abre ventana / incrementa conteo). */
  registrarFallo(clave: string): void;
  /** Reinicia la clave (tras un login exitoso) o todas (no-op con undefined). */
  reiniciar(clave?: string): void;
};

export function crearLimitadorIntentos(): LimitadorIntentos {
  type Entrada = { fallidos: number; ventanaInicio: number };
  const tabla = new Map<string, Entrada>();

  const ahora = (): number => Date.now();

  const dentroDeLaVentana = (entrada: Entrada): boolean =>
    ahora() - entrada.ventanaInicio < VENTANA_INTENTOS_MS;

  const limpiar = (): void => {
    const corte = ahora() - VENTANA_INTENTOS_MS;
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
      return entrada.fallidos < LIMITE_INTENTOS_FALLIDOS;
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
