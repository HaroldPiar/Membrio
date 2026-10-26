# Membrio

Multi-tenant SaaS for clubs/academies (first client: Truchas swim club). The specs are the source of truth for product decisions. Backend Fases 1–3 are implemented: data + auth/errors, the `/api/v1` endpoints (spec §9) and the Astro mount at `src/pages/api/[...route].ts`. **Client Fase 1 is implemented** (shell, login, sesión — `Specs/Spec del cliente.md`); client Fases 2–5 are pending.

## Commands

Vitest is the test runner; there is no linter or formatter yet. Static gate: `pnpm typecheck`.

- `pnpm typecheck` — `tsc --noEmit`. Strict: `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, `noUnusedLocals/Parameters`. TS 7 (native): `paths` substitutions must be **relative** (`./src/*`) — `baseUrl` was removed and fails compilation.
- `pnpm test` — unit tests (`tests/unit`): estado de pago, validación de pagos, casing, CSRF, formateo COP, menú por rol, mapeo de errores de la API, transformaciones del dashboard. 71 assertions.
- `pnpm test:integracion` — tenant-isolation + cookie de sesión/CSRF/búsqueda `?q=` (`tests/integracion`, needs DB + seed). 17 assertions.
- `pnpm dev:api` — standalone API on :3000 (no Astro needed). Example login: `POST /api/v1/auth/dev-login` with `{"correo":"admin@truchas.test"}`.
- `pnpm dev` — Astro on :4321 hosting the API (Astro 7 needs Node >= 22.23.4; cold start can take ~40s).
- `pnpm build` — Astro build to `dist/` (server output). Smoke it with `PORT=4399 node --env-file-if-exists=.env dist/server/entry.mjs`.
- `pnpm api:types` — regenerate `src/lib/tipos-api.ts` from the in-process OpenAPI (`scripts/api-types.ts`). Run after ANY API contract change; `pnpm typecheck` then proves the client compiles against the API.
- `pnpm db:generate` — regenerate migrations after editing `src/server/db/schema.ts`; then `pnpm db:schema-sql` to refresh `membrio_schema.sql`.
- DB flow: `pnpm db:migrate && pnpm db:seed && pnpm db:verify`. `db:verify` exits 1 on failure and runs each constraint check in its own ROLLBACK transaction (leaves no data behind).
- `pnpm verify:fase2` — offline smoke (env validation, JWT, SQLSTATE→HTTP mapping, app.request checks). No DB required; exits 1 on failure.

## Environment

- Node >= 22.9; Astro 7 (for `pnpm dev`) requires >= 22.23.4. Local Postgres runs via `docker-compose.yml` on host port **5433** (not 5432), database `membrio_prueba`. `DATABASE_URL` must target `:5433`.
- `.env` is gitignored; `.env.example` exists but is empty — it is not a usable template. Variables (`src/server/config/env.ts`):
  - `DATABASE_URL` — required.
  - `AUTH_MODE` — `dev` (default) | `supabase`.
  - `DEV_JWT_SECRET` — required in dev mode, min 32 chars, **no default value**.
  - `SUPABASE_JWT_SECRET` — required when `AUTH_MODE=supabase`.
- Env is validated by Zod at import: invalid env = the app refuses to start. `NODE_ENV=production` + `AUTH_MODE=dev` is hard-refused.
- Never generate or commit connection strings; the user fills `.env` manually (specplan restriction).
- `.pnpmfile.cjs` (repo root) nests `typescript@^5` **only** inside `openapi-typescript`: it declares peer `typescript: ^5.x` and TS 7 has no compiler API (`ts.factory`), so without the hook `pnpm api:types` crashes. The repo's own `tsc` stays on TS 7. Don't delete the file.

## Specs

| File | Defines |
|------|---------|
| `Specs/Spec técnico de arquitectura.md` | Binding technical decisions for the MVP (stack, multi-tenancy, API design, data rules). Start here. |
| `Specs/Spec.md` | Product vision and objectives. |
| `Specs/SpecTruchas.md` | First client: Google Forms fields and Sheets layouts the MVP must import from. |
| `Specs/specplan.md` | The phased implementation plan that drove Fases 1–2; states the layering and phase verifications. |
| `Specs/Spec del cliente.md` | Web client: visual identity, routes, client technical decisions, decision log (§7) and phase plan (§9). |

## Decided — do not re-litigate

Stack (spec §2): Astro + React islands (Fase 3), Hono API on Vercel, Drizzle ORM over Postgres (Supabase later), Supabase Auth + Storage, Zod, pnpm. Migrations must run on plain local Postgres — no Supabase-specific objects (roles, `auth` schema) in them.

Invariants agents commonly violate by default (spec §5–§8):

- `organizacion_id` comes only from the authenticated session — never from body, URL, or query params.
- A resource missing for the tenant returns **404, not 403** (don't reveal cross-tenant existence).
- Money is `numeric(12,2)`; API sends decimal **strings**, never floating-point `number`.
- Payment state (Al día / Por vencer / En mora) is **computed** in TypeScript (`src/server/services/estado-pago.ts`), never stored — specplan Fase 3 replaced the SQL-view approach.
- Affiliate removal is logical (`activo = false`), never a hard delete.
- Multi-table writes (payments, retiro) run in a transaction.
- The postgres driver uses `prepare: false` (`src/server/db/client.ts`) — required for the Supabase pooler; do not "fix" it.
- Client session: cookie `membrio_session` (httpOnly, set by `dev-login`, cleared by `POST /auth/logout`). Tokens NEVER in localStorage/sessionStorage — localStorage only holds `membrio_tema` and `membrio_menu_colapsado`.
- Client-side code (`src/components`, `src/layouts`, `src/lib`, `src/pages`, `src/middleware.ts`) imports `src/shared` but **never** `src/server`. Sole documented exception: `scripts/api-types.ts`.
- Client never computes money: `formatearDinero` takes the API's decimal **string**, validates it with `esDecimal` first (Intl does not validate — it renders `$ NaN`/`$ 0`) and formats with `Intl.NumberFormat('es-CO', { currency: 'COP' })`.

## Architecture & conventions

- Layers: `routes` (Zod parsing, no logic) → `services` (rules + transactions) → `repositories` (the only place that touches Drizzle). Every repository receives the context `{ usuarioId, organizacionId, rol }`. Seeds/scripts are the documented exception and use Drizzle directly.
- All errors — including 404s — use the uniform envelope `{ error: { code, message, details } }` from `src/server/errors.ts`.
- Spanish everywhere: identifiers (`manejarErrores`, `Entorno`), error messages, table names, docs, UI copy.
- Data model source of truth is `src/server/db/schema.ts`. Files in `drizzle/` are generated; `membrio_schema.sql` is a derived reference — regenerate with `pnpm db:schema-sql`, never hand-edit.
- The Hono app (`src/server/app.ts`) is exported independent of Astro so it can be tested without it; it is mounted at `src/pages/api/[...route].ts` (`export const ALL` → `app.fetch`).
- Multi-tenant schema pattern: composite FKs `(id, organizacion_id)` on planes, categorias, afiliados, pagos.
- Client structure (Astro conventions): `src/layouts` (`AppLayout.astro` with `<ClientRouter />` + `transition:persist` on the sidebar; `AuthLayout.astro` with the brand gradient), `src/pages` (login, index, afiliados, pagos, admin), `src/components/{ui,layout}` (React, Spanish identifiers: `Boton`, `Tarjeta`, `BarraLateral`…), `src/lib` (`api.ts` openapi-fetch wrapper + `mapearErrorApi`/`procesar`, `sesion.ts` `/me` + logout, `tema.ts`, `formato.ts`, `cn.ts`), `src/lib/tipos-api.ts` (generated — never hand-edit), `src/middleware.ts` (route protection, verifies the cookie JWT with jose; UX only — security is the API's `requerirAuth`).
- Route protection lives in Astro's `src/middleware.ts`, NOT in `requerirAuth`: middleware guards page HTML (no flash), `requerirAuth` guards data. Both check `iss: membrio` / `aud: membrio-api` / HS256.
- Menu data (`src/components/layout/entradas-menu.ts`) is pure (no React/icons) so role filtering is unit-testable; icon keys map to lucide in `barra-lateral.tsx`.
- Dashboard (client Fase 2): one island `src/components/dashboard/dashboard.tsx` (single QueryClient) over `/api/v1/dashboard/{resumen,morosidad,recaudo}`; pure transforms in `src/lib/dashboard-datos.ts` (unit-tested: money stays a string, sorting in exact cents via `centavosDesdeCadena`, bar `magnitud` is geometry-only); Recharts colors go through `src/styles/graficos.css` CSS vars (SVG attributes don't resolve `var()`). Morosos link to `/afiliados?estado=en_mora` — Fase 3 must read that query param.
- `.atl/` is auto-generated (gentle-ai skill-registry) — don't edit by hand.
