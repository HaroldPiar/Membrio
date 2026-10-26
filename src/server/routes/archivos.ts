/**
 * Archivos (spec §9 y §10):
 *   POST /api/v1/archivos/subida  → URL firmada de subida (PUT por el cliente)
 *   POST /api/v1/archivos/lectura → URL firmada de lectura (tras validar tenant)
 *   PUT/GET /api/v1/archivos/local → emulación local de Storage (firma+expira;
 *     oculta de OpenAPI: no forma parte del contrato §9, es el transporte del
 *     proveedor local de desarrollo — el navegador sube/baja directo, §10)
 *
 * El Bearer solo cubre /subida y /lectura: las URLs firmadas de /local se
 * autentican con HMAC (el cliente no envía token).
 */
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';

import type { EnvAplicacion } from '../middleware/auth';
import { contextoDe, requerirAuth } from '../middleware/auth';
import { AppError } from '../errors';
import * as servicio from '../services/archivos';
import { almacen } from '../storage';
import { verificarFirma } from '../storage/local';
import { serializar } from '../../shared/casing';
import {
  lecturaArchivoSchema,
  subidaArchivoSchema,
  TAMANO_MAXIMO_BYTES,
  urlFirmadaSchema,
} from '../../shared/archivos';
import { respuestasError } from '../../shared/errores';

const rutaSubida = createRoute({
  method: 'post',
  path: '/api/v1/archivos/subida',
  summary: 'Pide una URL firmada de subida (PDF/JPG/PNG/WEBP, máx 10 MB)',
  request: {
    body: { content: { 'application/json': { schema: subidaArchivoSchema } }, required: true },
  },
  responses: {
    201: {
      description: 'URL firmada de subida; la ruta devuelta es la que se guarda en la base',
      content: { 'application/json': { schema: urlFirmadaSchema } },
    },
    ...respuestasError(400, 401, 403),
  },
});

const rutaLectura = createRoute({
  method: 'post',
  path: '/api/v1/archivos/lectura',
  summary: 'Pide una URL firmada de lectura para una ruta de la organización',
  request: {
    body: { content: { 'application/json': { schema: lecturaArchivoSchema } }, required: true },
  },
  responses: {
    201: { description: 'URL firmada de lectura', content: { 'application/json': { schema: urlFirmadaSchema } } },
    ...respuestasError(400, 401, 404),
  },
});

const queryLocal = z.object({
  accion: z.enum(['subir', 'leer']),
  ruta: z.string().min(3).max(500),
  expira: z.string().regex(/^\d+$/),
  firma: z.string().regex(/^[0-9a-f]{64}$/),
});

export const rutasArchivos = new OpenAPIHono<EnvAplicacion>();

// Autenticación SOLO en los endpoints del contrato §9 (el /local usa firma).
rutasArchivos.use('/api/v1/archivos/subida', requerirAuth);
rutasArchivos.use('/api/v1/archivos/lectura', requerirAuth);

rutasArchivos.openapi(rutaSubida, async (c) => {
  const resultado = await servicio.solicitarSubida(contextoDe(c), c.req.valid('json'));
  return c.json(serializar(urlFirmadaSchema, resultado), 201);
});

rutasArchivos.openapi(rutaLectura, async (c) => {
  const resultado = await servicio.solicitarLectura(contextoDe(c), c.req.valid('json').ruta);
  return c.json(serializar(urlFirmadaSchema, resultado), 201);
});

// --- Transporte del proveedor local (HMAC + expiración, sin Bearer) --------

function parametrosLocales(query: Record<string, string>): { accion: 'subir' | 'leer'; ruta: string } {
  const parseo = queryLocal.safeParse(query);
  if (!parseo.success) {
    // URL vencida, malformada o ajena: misma respuesta (§5.4).
    throw new AppError(404, 'NO_ENCONTRADO', 'Archivo no encontrado');
  }
  verificarFirma(parseo.data.accion, parseo.data); // lanza 404 si no cuadra/expiró
  return parseo.data;
}

rutasArchivos.put('/api/v1/archivos/local', async (c) => {
  const { accion, ruta } = parametrosLocales(c.req.query());
  if (accion !== 'subir') throw new AppError(404, 'NO_ENCONTRADO', 'Archivo no encontrado');
  const bytes = new Uint8Array(await c.req.arrayBuffer());
  if (bytes.byteLength > TAMANO_MAXIMO_BYTES) {
    throw new AppError(400, 'VALIDACION', `El tamaño máximo por archivo es ${TAMANO_MAXIMO_BYTES} bytes (10 MB)`);
  }
  await almacen.subir(ruta, bytes);
  return c.json({ ok: true }, 201);
});

rutasArchivos.get('/api/v1/archivos/local', async (c) => {
  const { accion, ruta } = parametrosLocales(c.req.query());
  if (accion !== 'leer') throw new AppError(404, 'NO_ENCONTRADO', 'Archivo no encontrado');
  const bytes = await almacen.leer(ruta);
  // Tipado, no lógica: con lib DOM (cliente), BodyInit exige Uint8Array<ArrayBuffer>
  // y la interfaz declara Uint8Array genérico. readFile entrega Buffer con ArrayBuffer
  // plano, así que el cast es honesto. NO usar bytes.buffer: Buffer usa slab en pooling
  // y el slab puede ser más grande que la vista.
  return new Response(bytes as Uint8Array<ArrayBuffer>, {
    headers: {
      'content-type': tipoDesdeRuta(ruta),
      'cache-control': 'private, max-age=0, no-store',
    },
  });
});

function tipoDesdeRuta(ruta: string): string {
  if (ruta.endsWith('.pdf')) return 'application/pdf';
  if (ruta.endsWith('.jpg')) return 'image/jpeg';
  if (ruta.endsWith('.png')) return 'image/png';
  return 'image/webp';
}
