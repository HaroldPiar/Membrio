/**
 * Protección de rutas SIN parpadeo (Spec del cliente, Fase 1 Paso 3): las
 * páginas se resuelven en servidor, así que el redirect ocurre ANTES de que
 * exista HTML del contenido protegido. Con sesión válida en /login → '/';
 * sin sesión en página protegida → '/login'.
 *
 * Verifica el JWT de la cookie con los mismos parámetros que el backend
 * (HS256, iss 'membrio', aud 'membrio-api') pero NO toca la base: esto es UX
 * de navegación, no seguridad. La seguridad real vive en la API (requerirAuth
 * revalida token Y usuario activo en cada petición).
 *
 * Task (gestión de usuarios en producción): mientras el usuario tenga el flag
 * `debe_cambiar_password` activo (claim informativo `dcp: true` en el JWT,
 * firmado por el backend según la base) se le redirige desde cualquier página
 * protegida hacia `/cambiar-password`, que es la única ruta adicional permitida.
 * Al cambiar la contraseña el backend emite un JWT con `dcp: false` y este
 * middleware lo refleja redirigiendo a `/`.
 *
 * ¿Por qué no importar src/server/middleware/auth? Porque el cliente jamás
 * importa de src/server (restricción de estructura); esta verificación queda
 * en el glue de Astro. Decisión anotada en el Spec del cliente §7.
 */
import { defineMiddleware } from 'astro:middleware';
import { jwtVerify } from 'jose';

import { seleccionarSecretoSesion } from './lib/secreto-sesion';

const COOKIE_SESION = 'membrio_session';
const RUTAS_PROTEGIDAS: readonly RegExp[] = [
  /^\/$/,
  /^\/afiliados(\/|$)/,
  /^\/pagos(\/|$)/,
  /^\/admin(\/|$)/,
  /^\/cambiar-password(\/|$)/,
];

async function haySesionValida(token: string, secreto: string | undefined): Promise<boolean> {
  if (!secreto) return false;
  try {
    await jwtVerify(token, new TextEncoder().encode(secreto), {
      algorithms: ['HS256'],
      issuer: 'membrio',
      audience: 'membrio-api',
    });
    return true;
  } catch {
    return false;
  }
}

/** Claim informativo `dcp` (debe cambiar password) del token; false si no decodifica. */
async function decodificarDebeCambiar(token: string, secreto: string | undefined): Promise<boolean> {
  if (!secreto) return false;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secreto), {
      algorithms: ['HS256'],
      issuer: 'membrio',
      audience: 'membrio-api',
    });
    return typeof payload.dcp === 'boolean' ? payload.dcp : false;
  } catch {
    return false;
  }
}

export const onRequest = defineMiddleware(async (context, next) => {
  const ruta = context.url.pathname;
  if (ruta.startsWith('/api/')) return next();

  const protegida = RUTAS_PROTEGIDAS.some((expresion) => expresion.test(ruta));
  const esLogin = ruta === '/login';
  const esRutaCambioPassword = ruta === '/cambiar-password';
  if (!protegida && !esLogin) return next();

  const token = context.cookies.get(COOKIE_SESION)?.value;
  const secreto = seleccionarSecretoSesion({
    authMode: process.env.AUTH_MODE,
    devJwtSecret: process.env.DEV_JWT_SECRET,
    sessionJwtSecret: process.env.SESSION_JWT_SECRET,
    supabaseJwtSecret: process.env.SUPABASE_JWT_SECRET,
  });
  const valido = token ? await haySesionValida(token, secreto) : false;

  if (protegida && !valido) return context.redirect('/login');

  if (protegida) {
    const dcp = token ? await decodificarDebeCambiar(token, secreto) : false;
    // Mientras debe cambiar contraseña, toda página protegida (salvo
    // /cambiar-password) redirige al cambio; con el flag en false,
    // /cambiar-password → '/'.
    if (dcp) {
      if (!esRutaCambioPassword) return context.redirect('/cambiar-password');
    } else if (esRutaCambioPassword) {
      return context.redirect('/');
    }
  }

  if (esLogin && valido) return context.redirect('/');
  return next();
});
