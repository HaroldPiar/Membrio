import { defineConfig } from 'drizzle-kit';
import 'dotenv/config';

// Carga .env si existe; para `db:generate` no hace falta base conectada.
try {
  process.loadEnvFile('.env');
} catch {
  // sin .env: solo generate es viable
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/server/db/schema.ts',
  out: './drizzle',
  verbose: true,
  strict: true,
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
});
