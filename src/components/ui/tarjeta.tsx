/** Tarjeta (patrón shadcn/ui) sobre la superficie del tema. */
import type { HTMLAttributes } from 'react';

import { cn } from '../../lib/cn';

export function Tarjeta({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-lg border border-border bg-surface text-foreground shadow-sm', className)}
      {...props}
    />
  );
}

export function TarjetaEncabezado({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />;
}

export function TarjetaTitulo({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn('text-lg font-semibold leading-none tracking-tight', className)} {...props} />;
}

export function TarjetaDescripcion({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-muted-foreground', className)} {...props} />;
}

export function TarjetaContenido({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-6 pt-0', className)} {...props} />;
}
