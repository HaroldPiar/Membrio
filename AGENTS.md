# Membrio

Spec-first repo: no application code exists yet. The specs ARE the product — read them before writing code.

## Source of truth

| File | Defines |
|------|---------|
| `Spec técnico de arquitectura.md` | Binding technical decisions for the MVP (stack, multi-tenancy, API design, data rules, testing strategy). Start here. |
| `Spec.md` | Product vision and objectives. |
| `SpecTruchas.md` | First client (Truchas, swim club): Google Forms fields and Sheets layouts the MVP must import from. |

## Decided — do not re-litigate

Stack (spec §2, decision registry §15): Astro + React islands, Hono API on Vercel, Drizzle ORM over Supabase Postgres, Supabase Auth + Storage, Zod, pnpm, Vitest + Playwright.

Invariants agents commonly violate by default (spec §5–§8):

- `organizacion_id` comes only from the authenticated session — never from body, URL, or query params.
- A resource missing for the tenant returns **404, not 403** (don't reveal cross-tenant existence).
- Money is `numeric(12,2)`; API sends decimal **strings**, never floating-point `number`.
- Payment state (Al día / Por vencer / En mora) is **computed** in view `v_estado_pago`, never stored.
- Affiliate removal is logical (`activo = false`), never a hard delete.
- Multi-table writes (payments, retiro) run in a transaction.

## Conventions

- Docs, API resources, table names, and UI copy are in **Spanish**.
- `.atl/` is auto-generated (gentle-ai skill-registry) — don't edit by hand.
- `membrio_schema.sql` is referenced by the architecture spec but doesn't exist yet; create/verify it rather than assuming its contents.
