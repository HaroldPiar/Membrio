/**
 * Deriva `membrio_schema.sql` (archivo de REFERENCIA) a partir de las
 * migraciones generadas en drizzle/.
 *
 * No editar a mano y no usar para migrar: la fuente de verdad es
 * src/server/db/schema.ts + drizzle/. Regenerar con: pnpm db:schema-sql
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');

type Journal = { entries: { tag: string }[] };

const journal = JSON.parse(readFileSync(join(raiz, 'drizzle', 'meta', '_journal.json'), 'utf8')) as Journal;

const sql = journal.entries
  .map((e) => readFileSync(join(raiz, 'drizzle', `${e.tag}.sql`), 'utf8'))
  .join('\n')
  // El separador puede venir al final de la línea del statement (migraciones cortas):
  // reemplazarlo por salto y descartar solo líneas vacías, sin tocar el SQL.
  .replaceAll('--> statement-breakpoint', '\n')
  .split('\n')
  .filter((linea) => linea.trim().length > 0)
  .join('\n')
  .trim();

const cabecera = `-- memmrio_schema.sql — REFERENCIA DERIVADA (generado con \`pnpm db:schema-sql\`)
-- NO editar a mano ni usar para migrar.
-- Fuente de verdad: src/server/db/schema.ts · Migraciones: drizzle/
-- Futuro Supabase Auth: usuarios.id pasará a referenciar auth.users(id)
-- (agregar en una migración personalizada; ver comentario en schema.ts).`;

writeFileSync(join(raiz, 'membrio_schema.sql'), `${cabecera}\n\n${sql}\n`);
console.log('membrio_schema.sql regenerado desde drizzle/');
