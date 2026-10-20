import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schema';

/**
 * Cliente de base de datos — una sola instancia por proceso (spec §6).
 * `prepare: false` es obligatorio con el pooler de Supabase en modo transaction
 * y no hace daño contra un Postgres local.
 *
 * DATABASE_URL NUNCA se genera ni se commitea: se toma del entorno (.env).
 */
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    'Falta DATABASE_URL. Copiar .env.example a .env y completar el valor local (Fase 1).',
  );
}

export const sqlClient = postgres(connectionString, { prepare: false, max: 3 });

export const db = drizzle(sqlClient, { schema });
