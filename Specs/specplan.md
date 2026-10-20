Implementa el backend de Membrio según el Spec técnico de arquitectura y los specs de dominio (Truchas) que ya conoces del contexto. Trabaja por fases y detente al final de cada una para que yo revise (indica qué comando correr para verificarla).

## Restricciones
- NO generes ni inventes ningún string de conexión. `.env.example` lleva `DATABASE_URL=` vacío; yo lo completaré. La base es Postgres local.
- No uses nada específico de Supabase en las migraciones (roles `anon`/`authenticated`, esquema `auth`, etc.): deben correr en un Postgres local normal.
- Stack: pnpm, TypeScript estricto, Astro mínimo solo para alojar la API, Hono montado en `src/pages/api/[...route].ts`, Drizzle (driver `postgres`, `prepare: false`), Zod, `@hono/zod-openapi`, Vitest. Sin frontend real.
- La app Hono vive en `src/server/app.ts` y se exporta de forma independiente de Astro, para poder probarla sin arrancar Astro.

## Estructura
src/server/{db,routes,services,repositories,middleware,storage,config}, src/shared (esquemas Zod y tipos), drizzle/ (migraciones), tests/.
Capas: routes (Zod, sin lógica) → services (reglas y transacciones) → repositories (único lugar con Drizzle). Todo repositorio recibe el contexto `{ usuarioId, organizacionId, rol }`.

## Fase 1: datos
- Esquema Drizzle como ÚNICA fuente de verdad: organizaciones, roles, eps (global), usuarios, planes, categorias, afiliados, acudientes, pagos, pago_detalle.
- FKs compuestas `(id, organizacion_id)` hacia planes, categorias, afiliados y pagos. UNIQUE `(organizacion_id, tipo_tipo_documento, numero_documento)` en afiliados y UNIQUE `(afiliado_id, concepto, fecha_cobertura)` en pago_detalle.
- `usuarios.id` es uuid, sin `password_hash`, sin FK a `auth.users` (déjalo comentado para cuando se use Supabase). `timestamptz` en todos los timestamps. Montos `numeric(12,2)`.
- CHECKs: tipo_documento (TI, CC, RC, PAS, PPT), tipo_sangre, concepto, estado de pago (pendiente, verificado, rechazado), descuento entre 0 y 1, fecha_cobertura día 1. Índice único parcial: un acudiente principal por afiliado. Mantén en la migración personalizada solo lo que Drizzle no genere.
- Script `seed`: 1 organización demo (Truchas), roles admin y operador, catálogo básico de EPS, planes Básico y Pro (matrícula 74000), las categorías/cursos de Truchas, un usuario admin y uno operador, y algunos afiliados y pagos de ejemplo.
- Genera además `membrio_schema.sql` (derivado, solo como referencia).

## Fase 2: entorno, auth y errores
- Variables de entorno validadas con Zod al arrancar.
- `AUTH_MODE=dev|supabase`. En modo `dev`: endpoint `POST /api/v1/auth/dev-login` (existe solo si AUTH_MODE=dev) que recibe el correo de un usuario semilla y devuelve un JWT firmado (HS256, `DEV_JWT_SECRET`). En modo `supabase`: deja la interfaz y la validación de JWT preparadas, aunque no se pruebe aún.
- Middleware: valida Bearer token (y cookie si aplica), busca al usuario en `usuarios`, rechaza `activo = false`, crea el contexto inmutable. `requireRole('admin' | 'operador')` según la matriz del spec §4.
- `organizacion_id` sale SIEMPRE del contexto, nunca de body, query o URL. Recurso de otro tenant → 404, nunca 403.
- Errores uniformes `{ error: { code, message, details } }` con los códigos HTTP del spec §9.

## Fase 3: endpoints bajo /api/v1 (spec §9)
/me, /usuarios (admin), /planes, /categorias, /eps, /afiliados (filtros q, activo, categoria, plan, estado_pago; paginación limit/cursor, máx 100), /afiliados/:id/retiro, /afiliados/:id/acudientes, /acudientes/:id, /pagos (POST con líneas), /pagos/:id, /pagos/:id/estado, /archivos/subida, /archivos/lectura, /dashboard/resumen, /dashboard/morosidad, /dashboard/recaudo.

Reglas de negocio:
- Crear pago: una transacción; valida que cada afiliado sea del tenant, que `monto_total` sea igual a la suma de líneas, que no haya líneas duplicadas, que `fecha_cobertura` sea día 1 y que el número de documento sean solo dígitos. Nace en `pendiente`.
- Rechazar un pago libera (borra) sus líneas de detalle para permitir reintento.
- Matrícula: línea con concepto `matricula`, `fecha_cobertura` = 1 de enero del año.
- Retiro de afiliado: una transacción que fija activo=false, fecha_retiro y motivo_retiro. No hay borrado físico si el afiliado tiene pagos.
- Montos como strings decimales en la API; nunca `number`.
- Datos de facturación en `pagos` son snapshot, no se leen de afiliados ni acudientes.

## Estado de pago: en TypeScript, NO en una vista SQL
Servicio puro y testeable en `services/estado-pago.ts`, con constantes en `config` (meses facturables 2 a 12, día límite 5, ventana "Por vencer" 5 días, zona America/Bogota). Solo cuenta pagos verificados, afiliados activos y meses desde `fecha_ingreso`.
- En mora: algún mes facturable anterior al actual sin pago verificado.
- Por vencer: meses anteriores pagados, mes actual no, y faltan ≤ 5 días para el día límite.
- Al día: mes actual y anteriores cubiertos.
Documenta en comentarios que estas reglas son supuestos pendientes de validar con Truchas.

## Archivos
Define una interfaz `StorageProvider` (URL firmada de subida y de lectura, validación de tipo PDF/JPG/PNG/WEBP y tamaño máx 10 MB, ruta `{organizacion_id}/{tipo}/{uuid}.{ext}`). Implementa un proveedor local en disco para desarrollo; deja el de Supabase Storage como stub documentado.

## Swagger
Con `@hono/zod-openapi`: los esquemas Zod de `src/shared` definen validación Y documento OpenAPI 3.1. Swagger UI en `/api/v1/docs` y el JSON en `/api/v1/openapi.json`, solo cuando `NODE_ENV !== 'production'`. Declara `securityScheme` Bearer. Cada endpoint con ejemplos de request/response y sus errores.

## Pruebas (Vitest)
- Unitarias: estado de pago (casos al día, por vencer, mora, pago adelantado de varios meses, afiliado retirado), validación de pagos (suma, duplicados, día 1).
- Integración (requieren DATABASE_URL local; sepáralas con un script aparte): aislamiento entre dos organizaciones para afiliados, planes y pagos, incluido intentar referenciar un plan ajeno.

## Entregables finales
README con pasos: instalar, crear `.env`, correr migraciones, `seed`, levantar el servidor, abrir `/api/v1/docs`, hacer dev-login y ejecutar un flujo completo (crear afiliado, registrar pago de 3 meses, verificarlo y ver el dashboard).

Empieza solo por la Fase 1 y detente para revisión.


harold@Harold:/mnt/c/repos/Membrio$ opencode
Starting background server...
                                   ▄     
  █▀▀█ █▀▀█ █▀▀█ █▀▀▄ █▀▀▀ █▀▀█ █▀▀█ █▀▀█
  █  █ █  █ █▀▀▀ █  █ █    █  █ █  █ █▀▀▀
  ▀▀▀▀ █▀▀▀ ▀▀▀▀ ▀▀▀▀ ▀▀▀▀ ▀▀▀▀ ▀▀▀▀ ▀▀▀▀

  Session   Session init and setup
  Continue  opencode -s ses_eb4516ec1ffe4aeomg0Ta8oZg1

harold@Harold:/mnt/c/repos/Membrio$ opencode -s ses_eb4516ec1ffe4aeomg0Ta8oZg1
                                   ▄     
  █▀▀█ █▀▀█ █▀▀█ █▀▀▄ █▀▀▀ █▀▀█ █▀▀█ █▀▀█
  █  █ █  █ █▀▀▀ █  █ █    █  █ █  █ █▀▀▀
  ▀▀▀▀ █▀▀▀ ▀▀▀▀ ▀▀▀▀ ▀▀▀▀ ▀▀▀▀ ▀▀▀▀ ▀▀▀▀

  Session   Session init and setup
  Continue  opencode -s ses_eb4516ec1ffe4aeomg0Ta8oZg1

harold@Harold:/mnt/c/repos/Membrio$ 