# Membrio

API multi-tenant de afiliados y cobros para clubes y academias (primer cliente: Truchas). Este repo contiene la **API Hono + Drizzle (Fases 1–2)** y el **montaje en Astro con los endpoints `/api/v1` de la Fase 3**: sin frontend real todavía, la documentación interactiva vive en `/api/v1/docs`.

## Camino rápido

1. Instalar dependencias: `pnpm install`
2. Crear `.env` (ver [Variables de entorno](#variables-de-entorno)) — vos completás el `DATABASE_URL`.
3. Levantar la base: `docker compose up -d` y luego `pnpm db:migrate && pnpm db:seed`
4. Levantar la API: `pnpm dev:api` → <http://localhost:3000>
5. Abrir la docs: <http://localhost:3000/api/v1/docs> y correr el [flujo completo](#flujo-completo-con-curl).

Verificación esperada: `pnpm db:verify` imprime `25/25 verificaciones OK`.

## Requisitos

| Requisito | Versión / nota |
|-----------|----------------|
| Node.js | **>= 22.23.4** (Astro 7 lo exige; con nvm: `nvm install 22`) |
| pnpm | v12+ (`corepack enable pnpm` si hace falta) |
| Docker | Solo para la base: Postgres 16 en el puerto **5433** (`docker-compose.yml`) |

## Variables de entorno

`.env.example` existe pero está **vacío a propósito**: el string de conexión lo completás vos. Copialo y rellená:

| Variable | Obligatoria | Descripción |
|----------|-------------|-------------|
| `DATABASE_URL` | sí | Conexión a Postgres local. Debe apuntar al compose (`puerto 5433`, base `membrio_prueba` — ver `docker-compose.yml`). **Nunca se genera ni se commitea.** |
| `AUTH_MODE` | no | `dev` (default) o `supabase`. En producción solo se acepta `supabase`. |
| `DEV_JWT_SECRET` | en `dev` | Secreto de al menos 32 caracteres. Generalo vos (p. ej. `openssl rand -base64 48`). |
| `SUPABASE_JWT_SECRET` | con `supabase` | Secreto del proyecto Supabase. |

La validación es **al importar la app**: un `.env` inválido hace que el proceso arranque con error (por diseño).

## Base de datos

```bash
docker compose up -d        # Postgres 16 en :5433
pnpm db:migrate             # aplica drizzle/
pnpm db:seed                # datos iniciales: Truchas, roles, planes, categorías, usuarios de prueba
pnpm db:verify              # 25 checks de constraints (sale con 1 si falla)
```

Si cambiás `src/server/db/schema.ts`: `pnpm db:generate` y después `pnpm db:schema-sql` (regenera `membrio_schema.sql`, no se edita a mano).

## Levantar el servidor

| Comando | Qué hace |
|---------|----------|
| `pnpm dev:api` | API standalone en <http://localhost:3000> **sin Astro** (ideal para probar y desarrollar). |
| `pnpm dev` | Astro en <http://localhost:4321> (primer arranque en frío puede tardar ~1 min); la API cuelga de `/api/v1/*` vía `src/pages/api/[...route].ts`. |
| `pnpm build` / `pnpm preview` | Build SSR de Astro (adaptador `@astrojs/node`, modo standalone). |

La documentación OpenAPI 3.1 + Swagger UI está en:

- <http://localhost:3000/api/v1/docs> (o `:4321/api/v1/docs` con Astro)
- <http://localhost:3000/api/v1/openapi.json>

Solo existe cuando `NODE_ENV !== 'production'`. El esquema global es Bearer JWT; `dev-login` está declarado como ruta pública.

## Flujo completo con curl

Con la API levantada y el seed aplicado:

```bash
BASE=http://localhost:3000

# 1. Sesión (solo AUTH_MODE=dev)
TOKEN=$(curl -s -X POST $BASE/api/v1/auth/dev-login \
  -H 'content-type: application/json' \
  -d '{"correo":"admin@truchas.test"}' \
  | node -pe 'JSON.parse(require("fs").readFileSync(0)).token')
AUTH="authorization: Bearer $TOKEN"

# 2. Contexto: /me y catálogos
curl -s $BASE/api/v1/me -H "$AUTH"
PLAN_ID=$(curl -s $BASE/api/v1/planes -H "$AUTH" | node -pe 'JSON.parse(require("fs").readFileSync(0)).datos[0].id')
CAT_ID=$(curl -s $BASE/api/v1/categorias -H "$AUTH" | node -pe 'JSON.parse(require("fs").readFileSync(0)).datos[0].id')

# 3. Crear afiliado
curl -s -X POST $BASE/api/v1/afiliados -H "$AUTH" -H 'content-type: application/json' -d "{
  \"plan_id\": \"$PLAN_ID\", \"categoria_id\": \"$CAT_ID\",
  \"tipo_documento\": \"CC\", \"numero_documento\": \"1098765432\",
  \"nombre\": \"Sofía Ramírez\", \"celular\": \"3001234567\",
  \"correo\": \"familia@ejemplo.com\", \"tipo_sangre\": \"O+\",
  \"fecha_nacimiento\": \"2014-03-15\", \"fecha_ingreso\": \"2026-02-01\"
}"

# 4. Pago de 3 meses (feb–abr 2026; cada fecha SIEMPRE día 1)
curl -s -X POST $BASE/api/v1/pagos -H "$AUTH" -H 'content-type: application/json' -d '{
  "monto_total": "222000.00",
  "factura_tipo_documento": "CC", "factura_documento": "1234567890",
  "factura_nombre": "Acme S.A.S.",
  "lineas": [
    { "afiliado_id": "PEGA_EL_ID", "concepto": "mensualidad", "fecha_cobertura": "2026-02-01", "monto": "74000.00" },
    { "afiliado_id": "PEGA_EL_ID", "concepto": "mensualidad", "fecha_cobertura": "2026-03-01", "monto": "74000.00" },
    { "afiliado_id": "PEGA_EL_ID", "concepto": "mensualidad", "fecha_cobertura": "2026-04-01", "monto": "74000.00" }
  ]
}'

# 5. Verificar el pago (pendiente → verificado) y ver el estado
curl -s -X PATCH $BASE/api/v1/pagos/PEGA_EL_PAGO/estado -H "$AUTH" \
  -H 'content-type: application/json' -d '{"estado":"verificado"}'
curl -s "$BASE/api/v1/afiliados/PEGA_EL_AFILIADO" -H "$AUTH"   # estado_pago: al_dia | por_vencer | en_mora

# 6. Dashboard
curl -s $BASE/api/v1/dashboard/resumen -H "$AUTH"
curl -s $BASE/api/v1/dashboard/morosidad -H "$AUTH"
curl -s $BASE/api/v1/dashboard/recaudo -H "$AUTH"
```

## Pruebas y verificación

| Comando | Cobertura | Esperado |
|---------|-----------|----------|
| `pnpm typecheck` | `tsc --noEmit` estricto | sin errores |
| `pnpm test` | unitarias: estado de pago, validación de pagos, casing | 34/34 |
| `pnpm test:integracion` | aislamiento entre dos organizaciones (requiere DB + seed) | 6/6 |
| `pnpm verify:fase2` | smoke offline de la Fase 2 (sin DB) | 20/20 |
| `pnpm db:verify` | constraints de la base | 25/25 |

## Estructura

```
src/
  server/
    app.ts            # app Hono (exportada independiente de Astro)
    routes/           # capa HTTP: Zod + respuestas OpenAPI, sin lógica
    services/         # reglas de negocio y transacciones
    repositories/     # único lugar que toca Drizzle (contexto del tenant)
    middleware/       # auth (JWT), contexto {usuarioId, organizacionId, rol}
    storage/          # StorageProvider: AlmacenLocal firmado + stub Supabase
    db/               # schema.ts (fuente de verdad), client.ts, migraciones
    config/           # env.ts (validación Zod), constantes de negocio
  shared/             # esquemas Zod wire (snake_case) usados por API y futuro front
  pages/api/[...route].ts   # montaje de la app Hono en Astro
tests/{unit,integracion}/
Specs/                # specs de producto y plan de fases (fuente de verdad)
```

## Convenciones que la API garantiza

- `organizacion_id` sale **solo** de la sesión; un recurso ajeno responde **404** (nunca 403).
- Errores con forma uniforme `{ error: { code, message, details } }`.
- Montos como **strings decimales** (`numeric(12,2)`), nunca `number`.
- El estado de pago se **calcula** en `services/estado-pago.ts` (no se almacena).
- Bajas lógicas para afiliados (`activo = false`); los pagos se escriben en transacción.
- Swagger desactivado en `NODE_ENV=production`; `.storage/` (archivos locales) no se commitea.

## Estado

Fases 1–3 completas: datos + migraciones, auth/errores, y los 22 endpoints de `/api/v1` con documentación, pruebas y montaje Astro. Siguiente hito según `Specs/specplan.md`: frontend Astro (Fase 4) e integración Supabase Auth/Storage.
