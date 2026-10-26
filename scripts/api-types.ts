/**
 * Genera src/lib/tipos-api.ts desde el OpenAPI de la app Hono EN PROCESO:
 * importa la app y le pide su documento con app.request (sin levantar
 * servidor ni tocar la red — Spec del cliente §5, decisión 6).
 *
 * Si la API cambia, correr `pnpm api:types`; el cliente tipado de
 * openapi-fetch falla al compilar mientras los tipos estén viejos.
 *
 * No escribe secretos ni depende de la base: las consultas SQL solo ocurren
 * si una ruta las ejecuta, y aquí solo se lee el documento OpenAPI.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import openapiTS, { astToString } from 'openapi-typescript';

import { app } from '../src/server/app';
import { sqlClient } from '../src/server/db/client';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const destino = join(raiz, 'src', 'lib', 'tipos-api.ts');

const respuesta = await app.request('/api/v1/openapi.json');
if (!respuesta.ok) {
  throw new Error(`No se pudo obtener el documento OpenAPI: HTTP ${respuesta.status}`);
}
const documento = await respuesta.json();

await mkdir(dirname(destino), { recursive: true });
const ast = await openapiTS(documento as Parameters<typeof openapiTS>[0]);
const cabecera =
  '/* ARCHIVO GENERADO por `pnpm api:types` — NO editar a mano.\n' +
  ' * Si cambia la API, vuelve a correr el script: openapi-fetch compila contra estos tipos. */\n\n';
await writeFile(destino, cabecera + astToString(ast), 'utf8');

await sqlClient.end({ timeout: 5 });
console.log(`Tipos generados: ${destino}`);
