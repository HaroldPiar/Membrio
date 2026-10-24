/**
 * Conversión de claves camelCase ↔ snake_case entre el wire (JSON de la API,
 * en snake_case como la base: organizacion_id, fecha_cobertura) y el código
 * interno de services/repositories (en camelCase como las columnas Drizzle).
 *
 * aCamel es TÍPICO (Camel<T>): los services reciben DTOs camel bien tipados.
 * aSnake es de RUNTIME y devuelve unknown: las respuestas se cierran con
 * serializar(esquema, dato), que convierte, PARSEA con el esquema declarado en
 * la ruta (la respuesta es el contrato) y acota el tipo al del esquema.
 *
 * Es una convención mecánica sobre claves de objetos planos/nidificados: los
 * VALORES solo cambian en lo imprescindible (Date → ISO en salida). Se usa
 * deliberadamente en lugar de mappers manuales por recurso, que son propensos
 * a olvidar un campo nuevo y perderlo en silencio.
 */
import type { z } from '@hono/zod-openapi';

// --- Tipos ----------------------------------------------------------------

type CapitalPrimera<S extends string> = S extends `${infer F}${infer R}`
  ? `${Uppercase<F>}${R}`
  : S;

/** 'fecha_cobertura' → 'fechaCobertura' */
export type CamelKey<K extends string> = K extends `${infer A}_${infer B}`
  ? `${A}${CapitalPrimera<CamelKey<B>>}`
  : K;

export type Camel<T> = T extends Date
  ? T
  : T extends readonly unknown[]
    ? { [I in keyof T]: Camel<T[I]> }
    : T extends object
      ? { [K in keyof T as CamelKey<K & string>]: Camel<T[K]> }
      : T;

/** Campos opcionales que aceptan undefined explícito (exactOptionalPropertyTypes). */
export type Opcionales<T> = { [K in keyof T]?: T[K] | undefined };

// --- Runtime --------------------------------------------------------------

function aCamelClave(clave: string): string {
  return clave.replace(/_([a-z0-9])/g, (_m, c: string) => c.toUpperCase());
}

function transformarCamel(valor: unknown): unknown {
  if (valor instanceof Date || valor === null || valor === undefined) return valor;
  if (Array.isArray(valor)) return valor.map(transformarCamel);
  if (typeof valor === 'object') {
    const salida: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(valor as Record<string, unknown>)) {
      salida[aCamelClave(k)] = transformarCamel(v);
    }
    return salida;
  }
  return valor;
}

function transformarSnake(valor: unknown): unknown {
  if (valor instanceof Date) return valor.toISOString();
  if (valor === null || valor === undefined) return valor;
  if (Array.isArray(valor)) return valor.map(transformarSnake);
  if (typeof valor === 'object') {
    const salida: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(valor as Record<string, unknown>)) {
      salida[k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)] = transformarSnake(v);
    }
    return salida;
  }
  return valor;
}

/** snake_case → camelCase (wire → interno), con tipos corregidos. */
export function aCamel<T>(dato: T): Camel<T> {
  return transformarCamel(dato) as Camel<T>;
}

/** camelCase → snake_case (interno → wire); Date → ISO. Runtime, tipado en serializar. */
export function aSnake(dato: unknown): unknown {
  return transformarSnake(dato);
}

/**
 * Cierra una respuesta: convierte a snake_case y la valida con el esquema
 * declarado en la ruta. Si la fila tiene claves de más se recortan (z.object
 * por defecto strip) y los enums estrechos se validan — el contrato OpenAPI es
 * lo que se devuelve, no el shape interno de Drizzle.
 */
export function serializar<S extends z.ZodTypeAny>(esquema: S, dato: unknown): z.output<S> {
  return esquema.parse(aSnake(dato));
}
