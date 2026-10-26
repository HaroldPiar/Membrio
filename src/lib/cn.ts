import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Une clases a la manera de shadcn/ui: clsx + resolución de conflictos de Tailwind. */
export function cn(...entradas: ClassValue[]): string {
  return twMerge(clsx(entradas));
}
