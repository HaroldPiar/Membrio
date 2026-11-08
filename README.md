# Membrio

API multi-tenant de afiliados y cobros para clubes y academias (primer cliente: Truchas).

Este repo contiene **dos productos sobre una sola base**:

- **API Hono + Drizzle (Fases 1–2)** con el montaje en Astro (`src/pages/api/[...route].ts`) para los endpoints `/api/v1` de la Fase 3.
- **Cliente web (Fase 4 del cliente)**: Astro con React islands (login, dashboard, afiliados, pagos, admin) que consume la API con `openapi-fetch`. La documentación interactiva vive en `/api/v1/docs`.

## Camino rápido

1. Instalar dependencias: `pnpm install`
2. Crear `.env` (ver [Variables de entorno](#variables-de-entorno)) — vos completás el `DATABASE_URL`.
3. Levantar la base: `docker compose up -d` y luego `pnpm db:migrate && pnpm db:seed`
4. Levantar la API: `pnpm dev:api` → <http://localhost:3000>
5. Levantar el cliente: `pnpm dev` → <http://localhost:4321>
6. Abrir la docs: <http://localhost:3000/api/v1/docs> y correr el [flujo completo](#flujo-completo-con-curl).

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
| `AUTH_MODE` | no | `dev` (default), `password` (login propio correo + contraseña) o `supabase`. En producción se aceptan `password` o `supabase`; `dev` se rechaza. |
| `DEV_JWT_SECRET` | en `dev` | Secreto de al menos 32 caracteres. Generalo vos (p. ej. `openssl rand -base64 48`). |
| `SESSION_JWT_SECRET` | con `password` | Secreto de al menos 32 caracteres para firmar los JWT del login propio. |
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

## Gestión de usuarios (`AUTH_MODE=password`)

- **Alta:** el admin la hace en `/admin` → Usuarios. El sistema genera una contraseña temporal de 16 caracteres (sin caracteres ambiguos) y la muestra **una sola vez** en un diálogo copiable; no se envía por correo ni se vuelve a mostrar.
- **Restablecimiento:** el admin puede generar una temporal nueva desde la fila del usuario (mismo diálogo de una sola vez).
- **Cambio obligatorio:** al entrar con la temporal el cliente va **directo** a `/cambiar-password` (sin pasar por el dashboard) y el menú lateral oculta todos los módulos: no hay botón de cambio de contraseña en la barra, solo el aviso y «Cerrar sesión». Mientras el flag `debe_cambiar_password` esté activo la API responde `403 CAMBIO_PASSWORD_REQUERIDO` en todo salvo `GET /api/v1/me`, `POST /api/v1/auth/cambio-password` y `POST /api/v1/auth/logout`. Los campos de contraseña tienen botón para mostrar/ocultar.
- **Invalidación:** cambiar o restablecer la contraseña actualiza `password_changed_at`; los JWT emitidos antes responden `401` (la comparación fuerte es la huella `ph` del hash, que cubre incluso el mismo segundo).
- **Salvaguardas:** un admin no puede desactivarse ni quitarse el rol admin, y la organización no puede quedar sin ningún admin activo.
- **Bootstrap:** el primer admin se crea con `pnpm db:crear-admin <correo> <nombre> <slug> [admin|operador]` (rol `admin` por defecto).

No hay envío de correos ni recuperación automática todavía: la temporal se la pasa el admin al usuario por fuera del sistema (decisión §7 del Spec del cliente).

## Levantar el servidor

| Comando | Qué hace |
|---------|----------|
| `pnpm dev:api` | API standalone en <http://localhost:3000> **sin Astro** (ideal para probar y desarrollar). |
| `pnpm dev` | Astro en <http://localhost:4321> (primer arranque en frío puede tardar ~40s); la API cuelga de `/api/v1/*` vía `src/pages/api/[...route].ts`. |
| `pnpm build` / `pnpm preview` | Build SSR de Astro (adaptador `@astrojs/node`, modo standalone). |

Smoke de build standalone: `PORT=4399 node --env-file-if-exists=.env dist/server/entry.mjs`.

La documentación OpenAPI 3.1 + Swagger UI está en:

- <http://localhost:3000/api/v1/docs> (o `:4321/api/v1/docs` con Astro)
- <http://localhost:3000/api/v1/openapi.json>

Solo existe cuando `NODE_ENV !== 'production'`. El esquema global es Bearer JWT; `dev-login` y `login` están declarados como rutas públicas (en runtime se monta solo la del `AUTH_MODE` activo).

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

Con `AUTH_MODE=password` el paso 1 cambia: `POST /api/v1/auth/login` con `{"correo","password"}`. Si el usuario tiene `debe_cambiar_password` activo, solo puede llamar a `/me`, `/auth/cambio-password` y `/auth/logout` hasta cambiarla (ver [Gestión de usuarios](#gestión-de-usuarios-auth_modepassword)).

## Pruebas y verificación

| Comando | Cobertura | Esperado |
|---------|-----------|----------|
| `pnpm typecheck` | `tsc --noEmit` estricto | sin errores |
| `pnpm test` | unitarias: estado de pago, validación de pagos, afiliados, dashboard, admin, formato | **164/164** |
| `pnpm test:integracion` | aislamiento entre dos organizaciones, cookie/CSRF, `?q=`, reglas de pagos/afiliados, orden de afiliados, `?activo=false`, historial por afiliado | **34/34** (requiere DB + seed) |
| `pnpm verify:fase2` | smoke offline de la Fase 2 (sin DB) | **20/20** |
| `pnpm db:verify` | constraints de la base | **25/25** |

## Estructura

```
src/
  server/           # app Hono (src/server/app.ts), routes/, services/, repositories/,
                   # middleware/, storage/, db/, config/  + db schema/migrations
  shared/            # esquemas Zod wire (snake_case) usados por API y cliente
  pages/             # api/[...route].ts (montaje Hono en Astro) + páginas del cliente
    api/[...route].ts
    afiliados.astro, pagos.astro, pagos/nuevo.astro, admin.astro, index.astro, login.astro
  components/        # React islands del cliente (ui/, layout/, dashboard/, afiliados/, pagos/, admin/)
  layouts/           # AppLayout.astro, AuthLayout.astro
  lib/               # cliente: api.ts, consultas-*.ts, *-datos.ts (capas puras), sesion.ts, tema.ts, formato.ts, tipos-api.ts
  styles/            # global.css, graficos.css (tokens de estado para Recharts)
  middleware.ts      # protección de rutas del cliente
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

Invariantes de la ronda QA (ver `Specs/QASpec.md` y `Specs/Spec del cliente.md` §7):

- `?activo` en query se parsea con `z.preprocess` estricto (`'true'`/`'false'` → boolean, resto **400**). `z.coerce.boolean()` está prohibido.
- `afiliadoSchema` trae **dos** campos calculados, nunca almacenados: `estado_pago` y `meses_adeudados` (`['AAAA-MM']`).
- Un pago puede cubrir varios nadadores: el historial por afiliado usa `GET /api/v1/afiliados/{id}/pagos` (sus líneas, sin rechazados).
- En `/pagos` la única query param que controla UI es `?tab=cartera` (decisión 55, leída por `pestanaDeUrl`).
- El dropdown del filtro usa `position: fixed` (la tabla está en `overflow-x-auto`).
- El select del formulario recibe `catalogoFormulario` (activos, + el actual en edición marcado).

## Estado

Fases 1–3 completas (datos + migraciones, auth/errores, 22 endpoints `/api/v1` con docs, pruebas y montaje Astro) y **Fase 4/5 del cliente completas** (shell/login, dashboard, afiliados, pagos, admin sobre esa API).

**Ronda QA post-Fase 5 (28 oct 2026):** 6 unidades corregidas y cerradas (`Specs/QASpec.md`) con gates en verde — `pnpm typecheck`, `pnpm test` (164), `pnpm test:integracion` (34), `pnpm build` y smoke en `:4399`.

Siguiente hito según `Specs/specplan.md`: integración Supabase Auth/Storage.
