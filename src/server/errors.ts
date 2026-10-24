/**
 * Manejador de errores uniforme de la API (spec §9).
 *
 *  - AppError: errores de negocio/controlados con su status y code.
 *  - Errores de Postgres: se traducen por SQLSTATE usando pgCode()
 *      23505 (unique)  → 409 DUPLICADO
 *      23503 (FK)      → 422 REFERENCIA_INVALIDA
 *      23514 (CHECK)   → 422 RESTRICCION_VIOLADA
 *      23502 (not null)→ 422 DATO_OBLIGATORIO
 *      resto           → 500 ERROR_INTERNO sin detalles técnicos
 *  - ZodError → 400 VALIDACION con los issues de Zod en details.
 */
import type { Context } from 'hono';
import { ZodError } from 'zod';

import { pgCode } from './db/pg-error';
import type { RespuestaError } from '../shared/errores';

/** Status que usa la API (subconjunto de los que acepta c.json de Hono). */
export type StatusApi = 400 | 401 | 403 | 404 | 409 | 422 | 500;

export class AppError extends Error {
  constructor(
    public readonly status: StatusApi,
    public readonly code: string,
    message: string,
    public readonly details: unknown[] = [],
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/** Errores controlados por capa (sin loguear; el message ya es para el cliente). */
export function esAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}

// Traducción SQLSTATE → (status, code, message). El message es genérico en
// español y NO expone nombres de constraints ni SQL de la base.
const MAPA_PG: Record<string, { status: StatusApi; code: string; message: string }> = {
  '23505': { status: 409, code: 'DUPLICADO', message: 'El registro ya existe (duplicado)' },
  '23503': { status: 422, code: 'REFERENCIA_INVALIDA', message: 'Referencia inválida: el recurso referenciado no existe o pertenece a otra organización' },
  '23514': { status: 422, code: 'RESTRICCION_VIOLADA', message: 'Violación de una restricción de integridad de la base' },
  '23502': { status: 422, code: 'DATO_OBLIGATORIO', message: 'Falta un dato obligatorio' },
};

/** Traduce un error a (status, code, message) según su SQLSTATE; undefined si no es de Postgres. */
export function mapearErrorPg(err: unknown): { status: StatusApi; code: string; message: string } | undefined {
  const codigo = pgCode(err);
  return codigo ? MAPA_PG[codigo] : undefined;
}

/**
 * onError de Hono: cualquier error que salga de una ruta o middleware
 * termina aquí con la forma uniforme { error: { code, message, details } }.
 */
export function manejarErrores(err: unknown, c: Context): Response {
  if (esAppError(err)) {
    return c.json<RespuestaError>({ error: { code: err.code, message: err.message, details: err.details } }, err.status);
  }

  const pg = mapearErrorPg(err);
  if (pg) {
    return c.json<RespuestaError>({ error: { code: pg.code, message: pg.message, details: [] } }, pg.status);
  }

  if (err instanceof ZodError) {
    return c.json<RespuestaError>(
      { error: { code: 'VALIDACION', message: 'Datos inválidos', details: err.issues } },
      400,
    );
  }

  // 500: se loguea el error real, pero NUNCA se expone al cliente (spec §9).
  console.error('[error no controlado]', err);
  return c.json<RespuestaError>(
    { error: { code: 'ERROR_INTERNO', message: 'Error interno', details: [] } },
    500,
  );
}

/** Helper para el caso más común de la capa de servicios/repositories (spec: cross-tenant → 404). */
export function noEncontrado(recurso: string): AppError {
  return new AppError(404, 'NO_ENCONTRADO', `${recurso} no encontrado`);
}
