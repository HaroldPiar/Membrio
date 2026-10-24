/**
 * Entorno validado con Zod AL ARRANCAR (spec §12: falla rápido).
 *
 * Reglas duras (pedido del usuario):
 *  - Si NODE_ENV=production y AUTH_MODE=dev, la app SE NIEGA a arrancar.
 *  - DEV_JWT_SECRET es obligatorio en modo dev, mínimo 32 caracteres y
 *    SIN valor por defecto.
 *  - AUTH_MODE=supabase exige SUPABASE_JWT_SECRET (preparado, sin probar
 *    todavía: la fase real de Supabase usará @supabase/ssr para cookies).
 */
import { z } from 'zod';

const esquemaEntorno = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    AUTH_MODE: z.enum(['dev', 'supabase']).default('dev'),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL es obligatorio'),
    DEV_JWT_SECRET: z.string().optional(),
    SUPABASE_JWT_SECRET: z.string().optional(),
  })
  .superRefine((valor, ctx) => {
    if (valor.NODE_ENV === 'production' && valor.AUTH_MODE === 'dev') {
      ctx.addIssue({
        code: 'custom',
        path: ['AUTH_MODE'],
        message: 'AUTH_MODE=dev está prohibido en producción; use AUTH_MODE=supabase',
      });
    }
    if (valor.AUTH_MODE === 'dev') {
      if (!valor.DEV_JWT_SECRET) {
        ctx.addIssue({
          code: 'custom',
          path: ['DEV_JWT_SECRET'],
          message: 'DEV_JWT_SECRET es obligatorio en AUTH_MODE=dev (mínimo 32 caracteres, sin valor por defecto)',
        });
      } else if (valor.DEV_JWT_SECRET.length < 32) {
        ctx.addIssue({
          code: 'custom',
          path: ['DEV_JWT_SECRET'],
          message: `DEV_JWT_SECRET debe tener al menos 32 caracteres (tiene ${valor.DEV_JWT_SECRET.length})`,
        });
      }
    } else {
      // AUTH_MODE=supabase: la verificación de JWT usa SUPABASE_JWT_SECRET.
      if (!valor.SUPABASE_JWT_SECRET) {
        ctx.addIssue({
          code: 'custom',
          path: ['SUPABASE_JWT_SECRET'],
          message: 'SUPABASE_JWT_SECRET es obligatorio en AUTH_MODE=supabase',
        });
      } else if (valor.SUPABASE_JWT_SECRET.length < 32) {
        ctx.addIssue({
          code: 'custom',
          path: ['SUPABASE_JWT_SECRET'],
          message: `SUPABASE_JWT_SECRET debe tener al menos 32 caracteres (tiene ${valor.SUPABASE_JWT_SECRET.length})`,
        });
      }
    }
  });

export type Entorno = z.infer<typeof esquemaEntorno>;

/** Valida un mapa de variables crudo. Lanza con todos los errores si algo falta. */
export function validarEntorno(variables: Record<string, string | undefined>): Entorno {
  const resultado = esquemaEntorno.safeParse(variables);
  if (!resultado.success) {
    const detalles = resultado.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(raíz)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Entorno inválido:\n${detalles}`);
  }
  return resultado.data;
}

// Carga .env si existe (entrypoints sin --env-file-if-exists también funcionan).
try {
  process.loadEnvFile('.env');
} catch {
  // No hay .env: el proceso debe venir con las variables ya seteadas.
}

/** Entorno del proceso. Lanza al importar: la app NO arranca con un entorno inválido. */
export const entorno: Entorno = validarEntorno(process.env);
