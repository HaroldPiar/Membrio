/**
 * Botón con variantes (patrón shadcn/ui + cva sobre nuestros tokens).
 * Sin `asChild`/Radix por ahora: Fase 1 no necesita botones-enlace y evita
 * una dependencia extra (si shadcn lo pide al importar componentes, se agrega).
 */
import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes } from 'react';

import { cn } from '../../lib/cn';

const variantesBoton = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variante: {
        principal: 'bg-primary text-primary-foreground hover:bg-primary/90',
        borde: 'border border-border bg-surface text-foreground hover:bg-muted',
        fantasma: 'text-foreground/80 hover:bg-muted hover:text-foreground',
      },
      tamano: {
        normal: 'h-10 px-4 py-2',
        chico: 'h-9 px-3 text-sm',
        icono: 'h-9 w-9',
      },
    },
    defaultVariants: { variante: 'principal', tamano: 'normal' },
  },
);

export type PropiedadesBoton = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof variantesBoton>;

export function Boton({ className, variante, tamano, type, ...props }: PropiedadesBoton) {
  return (
    <button
      type={type ?? 'button'}
      className={cn(variantesBoton({ variante, tamano, className }))}
      {...props}
    />
  );
}
