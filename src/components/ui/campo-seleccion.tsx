/** Select nativo con los tokens del tema (patrón shadcn/ui, sin Radix). */
import { forwardRef, type SelectHTMLAttributes } from 'react';

import { cn } from '../../lib/cn';

export const CampoSeleccion = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function CampoSeleccion({ className, ...props }, referencia) {
    return (
      <select
        ref={referencia}
        className={cn(
          'flex h-10 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      />
    );
  },
);
