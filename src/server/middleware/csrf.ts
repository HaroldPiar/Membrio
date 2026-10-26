/**
 * Defensa CSRF para peticiones autenticadas POR COOKIE (spec del cliente §6).
 *
 * Solo aplica a métodos mutantes (POST/PATCH/PUT/DELETE) cuyo token de sesión
 * viene de la cookie httpOnly `membrio_session`: un ataque cross-site no puede
 * forzar esas peticiones sin que el navegador declare el origen. Las
 * peticiones con Authorization: Bearer no se ven afectadas (el atacante no
 * puede adjuntar la cabecera desde otro sitio).
 *
 * Regla de decisión (documentada en el Spec del cliente, §7):
 *  - Sec-Fetch-Site presente → solo `same-origin` o `none` pasan.
 *  - Sin Sec-Fetch-Site pero con Origin → el host del Origin debe coincidir
 *    con el host de la petición (`Origin: null` se rechaza).
 *  - Sin ninguna cabecera de origen → se permite (cliente no navegador:
 *    curl/scripts con cookie). Toda navegación moderna envía Origin o
 *    Sec-Fetch-Site, con lo cual un form/fetch cross-site siempre cae aquí.
 */

export type OrigenToken = 'cookie' | 'bearer' | 'ninguno';

const METODOS_MUTANTES = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

/** ¿Es un método que cambia estado? */
export function esMetodoMutante(metodo: string): boolean {
  return METODOS_MUTANTES.has(metodo.toUpperCase());
}

/** ¿La cabecera Sec-Fetch-Site declara el mismo origen (o navegación directa)? */
export function sitioSeguroSecFetchSite(valor: string): boolean {
  return valor === 'same-origin' || valor === 'none';
}

/** ¿El host del header Origin coincide con el host de la petición? */
export function origenPropio(origin: string | undefined, host: string | undefined): boolean {
  if (!origin || !host) return false;
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false; // incluye `Origin: null`
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  return url.host.toLowerCase() === host.toLowerCase();
}

export type PeticionCsrf = {
  readonly metodo: string;
  readonly origenToken: OrigenToken;
  readonly origin: string | undefined;
  readonly secFetchSite: string | undefined;
  readonly host: string | undefined;
};

/** Decisión pura: ¿se rechaza la petición con 403 CSRF? */
export function rechazarCsrf(p: PeticionCsrf): boolean {
  if (p.origenToken !== 'cookie') return false; // Bearer o sin sesión: nada que defender
  if (!esMetodoMutante(p.metodo)) return false;
  if (p.secFetchSite !== undefined) return !sitioSeguroSecFetchSite(p.secFetchSite);
  if (p.origin !== undefined) return !origenPropio(p.origin, p.host);
  return false; // sin cabeceras de origen: cliente no navegador (decisión anotada)
}
