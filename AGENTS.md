# Membrio

Multi-tenant SaaS for clubs/academies (first client: Truchas swim club). The specs are the source of truth for product decisions. Fases 1–3 are implemented: data + auth/errors, the `/api/v1` endpoints (spec §9) and the Astro mount at `src/pages/api/[...route].ts`. The real frontend (React islands) does not exist yet.

## Commands

Vitest is the test runner; there is no linter or formatter yet. Static gate: `pnpm typecheck`.

- `pnpm typecheck` — `tsc --noEmit`. Strict: `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, `noUnusedLocals/Parameters`.
- `pnpm test` — unit tests (`tests/unit`): estado de pago, validación de pagos, casing. 34 assertions.
- `pnpm test:integracion` — tenant-isolation tests (`tests/integracion`, needs DB + seed). 6 assertions.
- `pnpm dev:api` — standalone API on :3000 (no Astro needed). Example login: `POST /api/v1/auth/dev-login` with `{"correo":"admin@truchas.test"}`.
- `pnpm dev` — Astro on :4321 hosting the API (Astro 7 needs Node >= 22.23.4; cold start can take ~40s).
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

## Specs

| File | Defines |
|------|---------|
| `Specs/Spec técnico de arquitectura.md` | Binding technical decisions for the MVP (stack, multi-tenancy, API design, data rules). Start here. |
| `Specs/Spec.md` | Product vision and objectives. |
| `Specs/SpecTruchas.md` | First client: Google Forms fields and Sheets layouts the MVP must import from. |
| `Specs/specplan.md` | The phased implementation plan that drove Fases 1–2; states the layering and phase verifications. |

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

## Architecture & conventions

- Layers: `routes` (Zod parsing, no logic) → `services` (rules + transactions) → `repositories` (the only place that touches Drizzle). Every repository receives the context `{ usuarioId, organizacionId, rol }`. Seeds/scripts are the documented exception and use Drizzle directly.
- All errors — including 404s — use the uniform envelope `{ error: { code, message, details } }` from `src/server/errors.ts`.
- Spanish everywhere: identifiers (`manejarErrores`, `Entorno`), error messages, table names, docs, UI copy.
- Data model source of truth is `src/server/db/schema.ts`. Files in `drizzle/` are generated; `membrio_schema.sql` is a derived reference — regenerate with `pnpm db:schema-sql`, never hand-edit.
- The Hono app (`src/server/app.ts`) is exported independent of Astro so it can be tested without it; it is mounted at `src/pages/api/[...route].ts` (`export const ALL` → `app.fetch`).
- Multi-tenant schema pattern: composite FKs `(id, organizacion_id)` on planes, categorias, afiliados, pagos.
- `.atl/` is auto-generated (gentle-ai skill-registry) — don't edit by hand.
