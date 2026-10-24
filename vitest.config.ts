import { defineConfig } from 'vitest/config';

// Carga .env si existe (mismo patrón que drizzle.config.ts): las pruebas de
// integración necesitan DATABASE_URL; las unitarias corren sin ella.
try {
  process.loadEnvFile('.env');
} catch {
  // sin .env: solo unitarias son viables
}

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // Las integración usan timeouts propios por consulta contra Postgres.
    testTimeout: 15_000,
  },
});
