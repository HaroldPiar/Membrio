/** Campo de texto (patrón shadcn/ui) sobre nuestros tokens. */
import { forwardRef, type InputHTMLAttributes } from 'react';

import { cn } from '../../lib/cn';

export const CampoTexto = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function CampoTexto({ className, ...props }, referencia) {
    return (
      <input
        ref={referencia}
        className={cn(
          'flex h-10 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      />
    );
  },
);
