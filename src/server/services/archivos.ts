/**
 * Servicio de archivos (spec §10): valida tipo/tamaño/tenant y pide al
 * proveedor una URL firmada. La base guarda la RUTA, nunca una URL.
 *
 * En subida el tenant se fija desde la sesión al generar la ruta; en lectura
 * la ruta viene del cliente y debe empezar por el organizacion_id de la
 * sesión — si no coincide → 404 (no 403: no se revela que el archivo existe).
 */
import { randomUUID } from 'node:crypto';

import { AppError, noEncontrado } from '../errors';
import type { ContextoTenant } from '../middleware/auth';
import { almacen } from '../storage';
import { esRutaValida } from '../storage/local';
import {
  MIME_ACEPTADOS,
  TAMANO_MAXIMO_BYTES,
  TIPOS_ARCHIVO,
} from '../../shared/archivos';

export type DatosSubida = {
  tipo: (typeof TIPOS_ARCHIVO)[number];
  contenido_tipo: string;
  tamano_bytes: number;
};

export async function solicitarSubida(ctx: ContextoTenant, datos: DatosSubida) {
  const ext = MIME_ACEPTADOS[datos.contenido_tipo as keyof typeof MIME_ACEPTADOS];
  if (!ext) {
    throw new AppError(400, 'VALIDACION', 'Tipo de archivo no permitido (PDF, JPG, PNG o WEBP)');
  }
  if (datos.tamano_bytes > TAMANO_MAXIMO_BYTES) {
    throw new AppError(400, 'VALIDACION', `El tamaño máximo por archivo es ${TAMANO_MAXIMO_BYTES} bytes (10 MB)`);
  }
  const ruta = `${ctx.organizacionId}/${datos.tipo}/${randomUUID()}.${ext}`;
  const { url, expiraEn } = await almacen.urlSubida({ ruta, contentType: datos.contenido_tipo });
  return {
    ruta,
    url,
    metodo: 'PUT' as const,
    expira_en: expiraEn.toISOString(),
    content_type: datos.contenido_tipo,
    tamano_max_bytes: TAMANO_MAXIMO_BYTES,
  };
}

export async function solicitarLectura(ctx: ContextoTenant, ruta: string) {
  const [org, tipo] = ruta.split('/');
  if (org !== ctx.organizacionId || !TIPOS_ARCHIVO.includes(tipo as never) || !esRutaValida(ruta)) {
    // Ruta ajena o inválida: misma respuesta (spec §5.4).
    throw noEncontrado('Archivo');
  }
  const { url, expiraEn } = await almacen.urlLectura(ruta);
  return {
    ruta,
    url,
    metodo: 'GET' as const,
    expira_en: expiraEn.toISOString(),
    content_type: null,
    tamano_max_bytes: TAMANO_MAXIMO_BYTES,
  };
}
