/**
 * Proveedor local de desarrollo: archivos en disco bajo `.storage/` con
 * "URLs firmadas" emuladas: HMAC-SHA256 de (acción, ruta, expiración) con el
 * secreto del modo de autenticación activo (mismo secreto que el JWT; no se
 * agrega una variable de entorno nueva).
 *
 * Endpoints que las consumen (montados en routes/archivos.ts, ocultos de la
 * documentación porque no son parte del API §9):
 *   PUT /api/v1/archivos/local?accion=subir&ruta=…&expira=…&firma=…
 *   GET /api/v1/archivos/local?accion=leer&ruta=…&expira=…&firma=…
 *
 * Para Supabase Storage: implementar AlmacenSupabase (stub en supabase.ts)
 * reemplazando `almacen` en storage/index.ts — requiere SERVICE_ROLE key y
 * proyecto Supabase (pendiente de Fase Supabase).
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { AppError } from '../errors';
import { entorno } from '../config/env';
import type { UrlFirmada } from './tipos';
import type { StorageProvider } from './tipos';

const RAIZ = join(process.cwd(), '.storage');
const DURACION_SUBIDA_SEG = 15 * 60; // 15 min para subir
const DURACION_LECTURA_SEG = 5 * 60; // 5 min para leer (corta duración, §10)

function secreto(): string {
  // Asegurado por config/env.ts: en modo dev existe DEV_JWT_SECRET (>=32);
  // en modo supabase existe SUPABASE_JWT_SECRET.
  const clave = entorno.DEV_JWT_SECRET ?? entorno.SUPABASE_JWT_SECRET;
  if (!clave) throw new AppError(500, 'ERROR_INTERNO', 'Sin secreto para firmar archivos');
  return clave;
}

export function firmar(accion: 'subir' | 'leer', ruta: string, expira: number): string {
  return createHmac('sha256', secreto()).update(`${accion}\n${ruta}\n${expira}`).digest('hex');
}

/** Verifica firma y expiración; lanza 404 si no cuadra (una URL vencida no se explica). */
export function verificarFirma(
  accion: 'subir' | 'leer',
  params: { ruta: string; expira: string; firma: string },
): number {
  const expira = Number(params.expira);
  const esperada = firmar(accion, params.ruta, expira);
  const recibida = Buffer.from(params.firma ?? '', 'utf8');
  const valida =
    recibida.length === Buffer.from(esperada, 'utf8').length &&
    timingSafeEqual(recibida, Buffer.from(esperada, 'utf8'));
  if (!valida || !Number.isFinite(expira) || expira * 1000 < Date.now()) {
    throw new AppError(404, 'NO_ENCONTRADO', 'Archivo no encontrado');
  }
  return expira;
}

export function construirUrlFirmada(
  accion: 'subir' | 'leer',
  ruta: string,
  duracionSeg: number,
): UrlFirmada {
  const expira = Math.floor(Date.now() / 1000) + duracionSeg;
  const firma = firmar(accion, ruta, expira);
  const query = new URLSearchParams({ accion, ruta, expira: String(expira), firma });
  return {
    url: `/api/v1/archivos/local?${query.toString()}`,
    expiraEn: new Date(expira * 1000),
  };
}

/** Valida estricta de la ruta (defensa en profundidad contra traversal). */
export function esRutaValida(ruta: string): boolean {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const partes = ruta.split('/');
  if (partes.length !== 3) return false;
  const [org, tipo, archivo] = partes;
  if (!org || !uuid.test(org)) return false;
  if (tipo !== 'comprobante' && tipo !== 'documento') return false;
  const [nombre, ext] = (archivo ?? '').split('.');
  if (!nombre || !uuid.test(nombre)) return false;
  return ['pdf', 'jpg', 'png', 'webp'].includes(ext ?? '');
}

export class AlmacenLocal implements StorageProvider {
  async urlSubida(datos: { ruta: string; contentType: string }): Promise<UrlFirmada> {
    void datos.contentType; // el tipo ya se validó al firmar (MIME_ACEPTADOS)
    return construirUrlFirmada('subir', datos.ruta, DURACION_SUBIDA_SEG);
  }

  async urlLectura(ruta: string): Promise<UrlFirmada> {
    return construirUrlFirmada('leer', ruta, DURACION_LECTURA_SEG);
  }

  async subir(ruta: string, bytes: Uint8Array): Promise<void> {
    if (!esRutaValida(ruta)) {
      throw new AppError(400, 'VALIDACION', 'Ruta de archivo inválida');
    }
    const destino = join(RAIZ, ruta);
    await mkdir(dirname(destino), { recursive: true });
    await writeFile(destino, bytes);
  }

  async leer(ruta: string): Promise<Uint8Array> {
    if (!esRutaValida(ruta)) {
      throw new AppError(400, 'VALIDACION', 'Ruta de archivo inválida');
    }
    try {
      return new Uint8Array(await readFile(join(RAIZ, ruta)));
    } catch {
      throw new AppError(404, 'NO_ENCONTRADO', 'Archivo no encontrado');
    }
  }
}
