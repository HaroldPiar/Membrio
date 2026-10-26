/**
 * Cliente de la API: openapi-fetch contra los tipos de `pnpm api:types`
 * (Spec del cliente §5). `credentials: 'same-origin'` porque la sesión vive
 * en la cookie httpOnly `membrio_session` — nunca en storage del navegador.
 *
 * Manejo de errores (Spec del cliente §5):
 *  - 401 → redirige a /login desde cualquier petición;
 *  - 403 → "no tienes permiso";
 *  - 404, 409 y 422 → el mensaje que manda la API;
 *  - sin red u otro fallo → aviso genérico.
 * `mapearErrorApi` es puro y está cubierto por tests (tests/unit/errores).
 */
import createClient from 'openapi-fetch';

import type { paths } from './tipos-api';

export const api = createClient<paths>({ credentials: 'same-origin' });

export type TipoErrorApi =
  | 'sesion'
  | 'permiso'
  | 'no_encontrado'
  | 'conflicto'
  | 'validacion'
  | 'servidor'
  | 'red'
  | 'desconocido';

export class ErrorApi extends Error {
  constructor(
    readonly tipo: TipoErrorApi,
    readonly codigo: number,
    mensaje: string,
    readonly detalles: unknown[] = [],
  ) {
    super(mensaje);
    this.name = 'ErrorApi';
  }
}

/** Envolvente uniforme de la API: { error: { code, message, details } }. */
type EnvolventeError = { error?: { code?: string; message?: string; details?: unknown[] } };

/** Traduce (status, cuerpo) a un ErrorApi con mensaje listo para la interfaz. */
export function mapearErrorApi(codigo: number, cuerpo: unknown): ErrorApi {
  const envolvente = (cuerpo ?? {}) as EnvolventeError;
  const mensajeApi = envolvente.error?.message;
  const detalles = envolvente.error?.details ?? [];

  if (codigo === 401) {
    return new ErrorApi('sesion', codigo, 'Tu sesión expiró o no es válida. Inicia sesión de nuevo.');
  }
  if (codigo === 403) {
    return new ErrorApi('permiso', codigo, 'No tienes permiso para esta acción.', detalles);
  }
  if (codigo === 404) {
    return new ErrorApi('no_encontrado', codigo, mensajeApi ?? 'No se encontró lo solicitado.', detalles);
  }
  if (codigo === 409) {
    return new ErrorApi('conflicto', codigo, mensajeApi ?? 'Ya existe un registro con esos datos.', detalles);
  }
  if (codigo === 400 || codigo === 422) {
    return new ErrorApi('validacion', codigo, mensajeApi ?? 'Revisa los datos enviados.', detalles);
  }
  if (codigo >= 500) {
    return new ErrorApi('servidor', codigo, 'Error del servidor. Intenta de nuevo en un momento.', detalles);
  }
  return new ErrorApi('desconocido', codigo, mensajeApi ?? `Error inesperado (HTTP ${codigo}).`, detalles);
}

type RespuestaApi<T> = {
  data?: T | undefined;
  error?: unknown;
  response: Response;
};

/**
 * Desempaqueta una respuesta de openapi-fetch: devuelve los datos o lanza
 * ErrorApi. En 401 redirige a /login antes de lanzar (Spec del cliente §5).
 */
export async function procesar<T>(respuesta: PromiseLike<RespuestaApi<T>>): Promise<T> {
  let salida: RespuestaApi<T>;
  try {
    salida = await respuesta;
  } catch {
    throw new ErrorApi('red', 0, 'Sin conexión con el servidor. Revisa tu red.');
  }
  if (salida.response.ok) return salida.data as T;
  const error = mapearErrorApi(salida.response.status, salida.error);
  if (error.tipo === 'sesion' && typeof window !== 'undefined') {
    window.location.assign('/login');
  }
  throw error;
}
