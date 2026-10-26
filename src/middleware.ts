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
 * ¿Por qué no importar src/server/middleware/auth? Porque el cliente jamás
 * importa de src/server (restricción de estructura); esta verificación queda
 * en el glue de Astro. Decisión anotada en el Spec del cliente §7.
 */
import { defineMiddleware } from 'astro:middleware';
import { jwtVerify } from 'jose';

const COOKIE_SESION = 'membrio_session';
const RUTAS_PROTEGIDAS: readonly RegExp[] = [
  /^\/$/,
  /^\/afiliados(\/|$)/,
  /^\/pagos(\/|$)/,
  /^\/admin(\/|$)/,
];

async function haySesionValida(token: string): Promise<boolean> {
  try {
    const secreto =
      process.env.AUTH_MODE === 'supabase'
        ? process.env.SUPABASE_JWT_SECRET
        : process.env.DEV_JWT_SECRET;
    if (!secreto) return false;
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

export const onRequest = defineMiddleware(async (context, next) => {
  const ruta = context.url.pathname;
  if (ruta.startsWith('/api/')) return next();

  const protegida = RUTAS_PROTEGIDAS.some((expresion) => expresion.test(ruta));
  const esLogin = ruta === '/login';
  if (!protegida && !esLogin) return next();

  const token = context.cookies.get(COOKIE_SESION)?.value;
  const valido = token ? await haySesionValida(token) : false;

  if (protegida && !valido) return context.redirect('/login');
  if (esLogin && valido) return context.redirect('/');
  return next();
});
