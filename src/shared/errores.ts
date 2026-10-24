/**
 * Forma uniforme de error de la API (spec §9), compartida front y back:
 *   { "error": { "code": "...", "message": "...", "details": [...] } }
 *
 * Códigos que emite la API (no confundir con los SQLSTATE de Postgres,
 * que el servidor traduce a estos códigos y a un status HTTP):
 *  - VALIDACION (400), SESION_INVALIDA (401), USUARIO_INACTIVO (401),
 *    PERMISO_INSUFICIENTE (403), NO_ENCONTRADO (404),
 *    DUPLICADO (409), REFERENCIA_INVALIDA (422), RESTRICCION_VIOLADA (422),
 *    DATO_OBLIGATORIO (422), RUTA_NO_ENCONTRADA (404),
 *    CREDENCIALES_INVALIDAS (401), ERROR_INTERNO (500).
 */
export type RespuestaError = {
  error: {
    code: string;
    message: string;
    details: unknown[];
  };
};
