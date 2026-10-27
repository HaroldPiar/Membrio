/**
 * Capa pura de administración (Fase 5, Spec del cliente §4.6) — sin React,
 * para testearla con Vitest.
 *
 * REGLA DE MENSAJES (verificada con zodResolver v6): el resolver muestra el
 * PRIMER issue de cada campo, no el último — `flatten().fieldErrors[].at(-1)`
 * NO es lo que se ve en pantalla. Por eso los mensajes amables se colocan
 * donde SON el primer issue:
 *  - `superRefine` a nivel de CAMPO, después de checks base que PASAN con el
 *    valor vacío (así «Requerido» es el único/prime issue);
 *  - `refine().pipe()` (patrón de la decisión 37) para el select de rol: el
 *    refine falla primero y el enum del pipe ni se evalúa.
 *
 * Los esquemas espejan los wire de `src/shared` (usuarioCreacionSchema,
 * planCreacionSchema, categoriaCreacionSchema): mismos campos, mismos
 * límites — RHF llama a estos, el API valida los suyos.
 */
import { z } from '@hono/zod-openapi';

import { dineroSchema } from '../shared/dinero';
import { rolSchema } from '../shared/usuarios';

import type { Plan } from './consultas-afiliados';

// Mensajes de validación en español para este bundle también (patrón de la
// Fase 3): idempotente si afiliados-datos/pagos-datos ya lo configuraron.
z.config(z.locales.es());

export type Rol = z.infer<typeof rolSchema>;

export const ETIQUETAS_ROL: Record<Rol, string> = {
  admin: 'Administrador',
  operador: 'Operador',
};

/** Opciones del select de rol (sin la opción vacía, que agrega el formulario). */
export const OPCIONES_ROL: { valor: Rol; etiqueta: string }[] = (
  Object.entries(ETIQUETAS_ROL) as [Rol, string][]
).map(([valor, etiqueta]) => ({ valor, etiqueta }));

// ---------------------------------------------------------------------------
// Trozos compartidos de validación
// ---------------------------------------------------------------------------

/** Nombre de catálogo/usuario: obligatorio, 1–120 (mismo límite que el wire). */
const nombreObligatorio = z
  .string()
  .trim()
  .max(120, { message: 'Máximo 120 caracteres' })
  .superRefine((valor, ctx) => {
    if (!valor.trim()) ctx.addIssue({ code: 'custom', message: 'Requerido' });
  });

/** Monto como cadena decimal: obligatorio y con el formato de dineroSchema. */
const montoObligatorio = z
  .string()
  .trim()
  .superRefine((valor, ctx) => {
    if (!valor.trim()) {
      ctx.addIssue({ code: 'custom', message: 'Requerido' });
      return;
    }
    const comprobado = dineroSchema.safeParse(valor);
    if (!comprobado.success) {
      ctx.addIssue({
        code: 'custom',
        message: comprobado.error.issues[0]?.message ?? 'Monto inválido',
      });
    }
  });

// ---------------------------------------------------------------------------
// Usuarios (alta)
// ---------------------------------------------------------------------------

export const esquemaUsuario = z.object({
  correo: z
    .string()
    .trim()
    .toLowerCase()
    .superRefine((valor, ctx) => {
      if (!valor.trim()) {
        ctx.addIssue({ code: 'custom', message: 'Requerido' });
        return;
      }
      const comprobado = z.email({ message: 'Correo inválido' }).safeParse(valor);
      if (!comprobado.success) ctx.addIssue({ code: 'custom', message: 'Correo inválido' });
    }),
  nombre: nombreObligatorio,
  rol: z
    .string()
    .trim()
    .refine((valor) => (rolSchema.options as readonly string[]).includes(valor), {
      message: 'Selecciona un rol',
    })
    .pipe(rolSchema),
});

export type ValoresUsuario = z.input<typeof esquemaUsuario>;
export type DatosUsuario = z.output<typeof esquemaUsuario>;

/** Valores vacíos del alta de usuario (rol sin seleccionar). */
export function usuarioVacio(): ValoresUsuario {
  return { correo: '', nombre: '', rol: '' };
}

// ---------------------------------------------------------------------------
// Planes (alta y edición de valores)
// ---------------------------------------------------------------------------

export const esquemaPlan = z.object({
  nombre: nombreObligatorio,
  valor_mensualidad: montoObligatorio,
  valor_matricula: montoObligatorio,
});

export type ValoresPlan = z.input<typeof esquemaPlan>;
export type DatosPlan = z.output<typeof esquemaPlan>;

/** Valores vacíos del alta de plan. */
export function planVacio(): ValoresPlan {
  return { nombre: '', valor_mensualidad: '', valor_matricula: '' };
}

/** Valores precargados para editar los montos de un plan existente. */
export function planValores(plan: Plan): ValoresPlan {
  return {
    nombre: plan.nombre,
    valor_mensualidad: plan.valor_mensualidad,
    valor_matricula: plan.valor_matricula,
  };
}

// ---------------------------------------------------------------------------
// Categorías (alta y edición del nombre)
// ---------------------------------------------------------------------------

export const esquemaCategoria = z.object({
  nombre: nombreObligatorio,
});

export type ValoresCategoria = z.input<typeof esquemaCategoria>;
export type DatosCategoria = z.output<typeof esquemaCategoria>;

/** Valores vacíos del alta de categoría. */
export function categoriaVacia(): ValoresCategoria {
  return { nombre: '' };
}
