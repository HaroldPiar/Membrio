/**
 * Verificación de la Fase 2 (entorno, auth y errores) SIN base de datos.
 *
 * Cubre:
 *  1. Entorno: producción+dev prohibido, DEV_JWT_SECRET obligatorio (>=32, sin
 *     default), supabase exige SUPABASE_JWT_SECRET, config válida pasa.
 *  2. JWT: roundtrip firma/verificación, token alterado rechazado, otro secreto
 *     rechazado.
 *  3. Mapeo SQLSTATE → HTTP: 23505→409, 23503→422, 23514→422, 23502→422, resto sin mapear.
 *  4. App (app.request, sin red ni DB): dev-login con body inválido → 400;
 *     /me sin token → 401; /me con token basura → 401; ruta inexistente → 404 uniforme.
 *
 * Uso:  pnpm verify:fase2   (sale con código 1 si algo falla)
 */
import { mapearErrorPg } from '../src/server/errors';

// Defaults ANTES de importar cualquier módulo que cargue el entorno (ESM ejecuta
// los imports estáticos al inicio): así el smoke corre con o sin .env y sin pisar
// los valores reales del usuario (??= solo rellena lo que falta).
process.env.DEV_JWT_SECRET ??= 'x'.repeat(48);
process.env.DATABASE_URL ??= 'dummy';
process.env.NODE_ENV ??= 'development';
process.env.AUTH_MODE ??= 'dev';

const resultados: { nombre: string; ok: boolean; detalle?: string }[] = [];

function registrar(nombre: string, ok: boolean, detalle?: string): void {
  resultados.push(detalle === undefined ? { nombre, ok } : { nombre, ok, detalle });
}

async function main(): Promise<void> {
  // Imports dinámicos de los módulos que cargan el entorno (ya con defaults seteados).
  const { validarEntorno } = await import('../src/server/config/env');
  const { firmarTokenDev, verificarTokenSesion } = await import('../src/server/auth/jwt');

  // -------------------------------------------------------------------------
  // 1. Entorno (función pura; la app llama a validarEntorno al importar)
  // -------------------------------------------------------------------------
  const base = { DATABASE_URL: 'dummy', DEV_JWT_SECRET: 'x'.repeat(48) };

  const casos: { nombre: string; vars: Record<string, string | undefined>; esperaError: string | undefined }[] = [
    {
      nombre: 'producción + AUTH_MODE=dev → se niega a arrancar',
      vars: { ...base, NODE_ENV: 'production', AUTH_MODE: 'dev' },
      esperaError: 'prohibido en producción',
    },
    {
      nombre: 'dev sin DEV_JWT_SECRET → se niega (sin valor por defecto)',
      vars: { DATABASE_URL: 'dummy', AUTH_MODE: 'dev', DEV_JWT_SECRET: undefined },
      esperaError: 'DEV_JWT_SECRET es obligatorio',
    },
    {
      nombre: 'dev con DEV_JWT_SECRET de 31 caracteres → se niega',
      vars: { ...base, DEV_JWT_SECRET: 'x'.repeat(31) },
      esperaError: 'al menos 32 caracteres',
    },
    {
      nombre: 'supabase sin SUPABASE_JWT_SECRET → se niega',
      vars: { DATABASE_URL: 'dummy', AUTH_MODE: 'supabase' },
      esperaError: 'SUPABASE_JWT_SECRET es obligatorio',
    },
    { nombre: 'dev con secreto válido → arranca', vars: base, esperaError: undefined },
    {
      nombre: 'supabase con secreto válido → arranca',
      vars: { DATABASE_URL: 'dummy', AUTH_MODE: 'supabase', SUPABASE_JWT_SECRET: 'y'.repeat(48) },
      esperaError: undefined,
    },
  ];

  for (const caso of casos) {
    try {
      const entorno = validarEntorno(caso.vars);
      if (caso.esperaError) {
        registrar(caso.nombre, false, 'se esperaba rechazo y la config ACEPTÓ');
      } else if (!entorno.AUTH_MODE) {
        registrar(caso.nombre, false, 'config sin AUTH_MODE');
      } else {
        registrar(caso.nombre, true);
      }
    } catch (err) {
      const mensaje = (err as Error).message;
      if (caso.esperaError && mensaje.includes(caso.esperaError)) {
        registrar(caso.nombre, true);
      } else {
        registrar(caso.nombre, false, `error inesperado: ${mensaje.split('\n')[0]}`);
      }
    }
  }

  // -------------------------------------------------------------------------
  // 2. JWT (el proceso corre en modo dev con secreto válido gracias a los defaults)
  // -------------------------------------------------------------------------
  const token = await firmarTokenDev('usuario-de-prueba');
  try {
    const { usuarioId } = await verificarTokenSesion(token);
    registrar('JWT roundtrip: firma → verifica el mismo sub', usuarioId === 'usuario-de-prueba', `sub: ${usuarioId}`);
  } catch (err) {
    registrar('JWT roundtrip: firma → verifica el mismo sub', false, (err as Error).message);
  }

  const alterado = `${token.slice(0, -3)}aaa`;
  try {
    await verificarTokenSesion(alterado);
    registrar('JWT token alterado → rechazado', false, 'el token alterado ACEPTÓ');
  } catch {
    registrar('JWT token alterado → rechazado', true);
  }

  const { SignJWT } = await import('jose');
  const ajeno = await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('usuario-de-prueba')
    .setIssuer('membrio')
    .setAudience('membrio-api')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode('otro-secreto-distinto-de-48-chars!!!!!!!!'));
  try {
    await verificarTokenSesion(ajeno);
    registrar('JWT firmado con otro secreto → rechazado', false, 'el token ajeno ACEPTÓ');
  } catch {
    registrar('JWT firmado con otro secreto → rechazado', true);
  }

  // -------------------------------------------------------------------------
  // 3. Mapeo SQLSTATE → HTTP
  // -------------------------------------------------------------------------
  const mapeos: [unknown, string | undefined][] = [
    [{ code: '23505' }, '409'],
    [{ code: '23503' }, '422'],
    [{ code: '23514' }, '422'],
    [{ code: '23502' }, '422'],
    [{ cause: { code: '23505' } }, '409'], // Drizzle envuelve: el código está en cause
    [{ code: 'XX000' }, undefined], // error general de Postgres: sin mapeo → 500
    [new Error('error normal'), undefined],
  ];
  for (const [err, statusEsperado] of mapeos) {
    const mapeado = mapearErrorPg(err);
    const status = mapeado ? String(mapeado.status) : undefined;
    const etiqueta = JSON.stringify(err instanceof Error ? err.message : err);
    registrar(
      `mapearErrorPg ${etiqueta} → ${statusEsperado ?? 'sin mapeo (500)'}`,
      status === statusEsperado,
      status ? `obtenido ${mapeado?.code} ${status}` : 'obtenido: sin mapeo',
    );
  }

  // -------------------------------------------------------------------------
  // 4. App con app.request (sin red; solo rutas que NO tocan la base)
  // -------------------------------------------------------------------------
  const { app } = await import('../src/server/app');

  /** code del cuerpo { error: { code } } de una respuesta fallida. */
  const codigoError = async (respuesta: Response): Promise<string | undefined> =>
    ((await respuesta.json()) as { error?: { code?: string } }).error?.code;

  const loginInvalido = await app.request('/api/v1/auth/dev-login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ correo: 'no-es-correo' }),
  });
  registrar(
    'POST /auth/dev-login body inválido → 400 VALIDACION',
    loginInvalido.status === 400 && (await codigoError(loginInvalido)) === 'VALIDACION',
    `status ${loginInvalido.status}`,
  );

  const sinToken = await app.request('/api/v1/me');
  registrar(
    'GET /me sin token → 401 SESION_INVALIDA',
    sinToken.status === 401 && (await codigoError(sinToken)) === 'SESION_INVALIDA',
    `status ${sinToken.status}`,
  );

  const tokenBasura = await app.request('/api/v1/me', {
    headers: { authorization: 'Bearer basura.basura.basura' },
  });
  registrar(
    'GET /me con token basura → 401 SESION_INVALIDA',
    tokenBasura.status === 401 && (await codigoError(tokenBasura)) === 'SESION_INVALIDA',
    `status ${tokenBasura.status}`,
  );

  const inexistente = await app.request('/api/v1/nada');
  registrar(
    'Ruta inexistente → 404 RUTA_NO_ENCONTRADA uniforme',
    inexistente.status === 404 && (await codigoError(inexistente)) === 'RUTA_NO_ENCONTRADA',
    `status ${inexistente.status}`,
  );

  // -------------------------------------------------------------------------
  // Reporte
  // -------------------------------------------------------------------------
  let fallidos = 0;
  console.log('\n=== Fase 2 · verificación (sin DB) ===');
  for (const r of resultados) {
    if (!r.ok) fallidos += 1;
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.nombre}${r.ok ? '' : ` — ${r.detalle ?? ''}`}`);
  }
  console.log(`\n${resultados.length - fallidos}/${resultados.length} verificaciones OK`);
  if (fallidos > 0) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error('verify-fase2 falló:', err);
    process.exitCode = 1;
  })
  .finally(() => {
    // Cierra el cliente de DB si se creó (aunque ninguna ruta lo haya usado).
    import('../src/server/db/client')
      .then(({ sqlClient }) => sqlClient.end({ timeout: 5 }))
      .catch(() => undefined);
  });
