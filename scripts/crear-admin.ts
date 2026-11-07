/**
 * Crea (o actualiza la contraseña de) un usuario administrador en una
 * organización existente.
 *
 * Uso:   pnpm db:crear-admin <correo> <nombre> <slug-organizacion>
 *
 * - La contraseña se pide SIN ECO (con confirmación) desde la terminal, o se
 *   toma de ADMIN_PASSWORD si no hay terminal interactiva. NUNCA por argumento.
 * - Valida la política (12 a 128 caracteres), guarda solo el hash (scrypt) y
 *   no imprime la contraseña ni la URL de la base (solo el host de destino).
 * - Idempotente: si el correo ya existe, actualiza nombre y hash.
 */
import { eq } from 'drizzle-orm';

import { hashPassword } from '../src/server/auth/password';
import { entorno } from '../src/server/config/env';
import { db } from '../src/server/db/client';
import { organizaciones, roles, usuarios } from '../src/server/db/schema';

const LONGITUD_MINIMA = 12;
const LONGITUD_MAXIMA = 128;

function esContrasenaValida(contrasena: string): boolean {
  return contrasena.length >= LONGITUD_MINIMA && contrasena.length <= LONGITUD_MAXIMA;
}

/** Lee una línea sin eco desde la terminal: muestra el mensaje y soporta retroceso. */
function leerContrasena(mensaje: string): Promise<string> {
  return new Promise<string>((resolver, rechazar) => {
    const stdin = process.stdin;
    if (!stdin.isTTY || !process.stdout.isTTY) {
      rechazar(new Error('Sin terminal interactiva: define ADMIN_PASSWORD o ejecuta el script desde una terminal.'));
      return;
    }
    process.stdout.write(mensaje);
    let valor = '';

    const terminar = (error?: Error): void => {
      stdin.removeListener('data', onData);
      stdin.setRawMode(false);
      stdin.pause();
      process.stdout.write('\n');
      if (error) rechazar(error);
      else resolver(valor);
    };

    const onData = (chunk: Buffer): void => {
      for (const caracter of chunk.toString('utf8')) {
        if (caracter === '\r' || caracter === '\n') return terminar();
        if (caracter === '\u0003') return terminar(new Error('Cancelado.'));
        if (caracter === '\u007f' || caracter === '\b') {
          valor = valor.slice(0, -1);
          continue;
        }
        valor += caracter;
      }
    };

    stdin.setRawMode(true);
    stdin.resume();
    stdin.on('data', onData);
  });
}

async function main(): Promise<void> {
  const [correoCrudo, nombreCrudo, slug] = process.argv.slice(2);
  if (!correoCrudo || !nombreCrudo || !slug) {
    throw new Error('Uso: pnpm db:crear-admin <correo> <nombre> <slug-organizacion>');
  }
  // Mismo criterio que el login: el correo se guarda en minúsculas.
  const correo = correoCrudo.trim().toLowerCase();
  const nombre = nombreCrudo.trim();
  if (!correo.includes('@')) throw new Error('Correo inválido.');

  try {
    console.log(`Base de datos destino: ${new URL(entorno.DATABASE_URL).host}`);
  } catch {
    console.log('Base de datos destino: (no se pudo leer el host)');
  }

  const desdeEnv = process.env.ADMIN_PASSWORD || undefined;
  const contrasena = desdeEnv ?? (await leerContrasena('Contraseña: '));
  if (!esContrasenaValida(contrasena)) {
    throw new Error(`La contraseña debe tener entre ${LONGITUD_MINIMA} y ${LONGITUD_MAXIMA} caracteres.`);
  }
  if (desdeEnv === undefined) {
    const confirmacion = await leerContrasena('Repetir contraseña: ');
    if (confirmacion !== contrasena) throw new Error('Las contraseñas no coinciden.');
  }

  const [org] = await db
    .select({ id: organizaciones.id })
    .from(organizaciones)
    .where(eq(organizaciones.slug, slug))
    .limit(1);
  if (!org) throw new Error(`Organización no encontrada: ${slug}`);

  const [rol] = await db.select({ id: roles.id }).from(roles).where(eq(roles.nombre, 'admin')).limit(1);
  if (!rol) throw new Error('Rol admin no encontrado');

  const existente = await db
    .select({ id: usuarios.id })
    .from(usuarios)
    .where(eq(usuarios.correo, correo))
    .limit(1);

  if (existente.length > 0) {
    await db
      .update(usuarios)
      .set({ nombre, passwordHash: hashPassword(contrasena) })
      .where(eq(usuarios.correo, correo));
    console.log(`Contraseña actualizada para ${correo}.`);
    return;
  }

  await db.insert(usuarios).values({
    organizacionId: org.id,
    rolId: rol.id,
    correo,
    nombre,
    activo: true,
    passwordHash: hashPassword(contrasena),
  });
  console.log(`Usuario admin creado: ${correo} (organización ${slug}).`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('db:crear-admin falló:', err instanceof Error ? err.message : err);
    process.exit(1);
  });