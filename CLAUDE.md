# My-nutritionist — engineering guide

Mobile-first nutrition & wellness web app: log real meals, see today's nutrition, get adaptive
suggestions for the rest of the day, track weight and weekly activity. Wellness assistant —
**not** a medical tool. Works fully offline (guest/local mode) and syncs to Supabase when configured.

## Stack
Vite 8 · React 19 · TypeScript 6 (strict, `noUncheckedIndexedAccess`, `erasableSyntaxOnly`) ·
Tailwind CSS 4 (`@tailwindcss/vite`, tokens in `src/index.css`) · Zustand 5 · Zod 4 · Recharts 3 ·
lucide-react · Radix Dialog · sonner · idb (IndexedDB) · supabase-js 2 · Vitest 5 + RTL · Playwright.
Node 24 LTS lives in `~/.local/bin` (no system Node).

## Architecture rules (see docs/ARCHITECTURE.md)
- Layers: `features/* (UI)` → `stores/*` (Zustand) → `repositories/types.ts` interfaces / `services/*` → implementations.
  `domain/*` is pure TypeScript (no React, no I/O, no `Date.now()` — pass `now`/`today` in).
- UI never imports IndexedDB, Supabase, or provider response formats. Only `repositories/*`, `services/*`
  and `lib/supabase.ts` touch Supabase.
- React components never compute targets/nutrition/recommendations inline — call `domain/*` functions
  (via hooks/selectors in `features/*/hooks` or `stores/selectors`).
- Unknown nutrient values are `null`, never 0. Aggregates carry `knownCount`/`missingCount`.
- Local calendar dates are `YYYY-MM-DD` keys (`domain/dates.ts`); never use `toISOString().slice(0,10)` for a local date.
- Records use client-generated UUIDs (`lib/id.ts`) so saves are idempotent upserts.
- Language: neutral and supportive. Never "bad food", "cheat", "failure", "burn off", "earn". Calorie burn is informational only.
  Minors (<18) get general wellness targets — no deficit/surplus, no weight-change trajectory.
- No `any`, no TODOs, no placeholder handlers, no "coming soon" UI. Files ≲200 lines; split when larger.
- No enums/namespaces/parameter properties (`erasableSyntaxOnly`). Use `as const` arrays + union types.
- Imports use the `@/` alias for `src/`.

## Commands
```bash
npm run dev            # Vite dev server (http://localhost:5173)
npm run typecheck      # tsc -b (app + node configs)
npm run lint           # oxlint
npm test               # vitest run (unit + integration, jsdom)
npm run test:coverage  # with v8 coverage
npm run test:db        # RLS/DB tests against local Supabase (needs `npm run db:start`)
npm run test:e2e       # Playwright (system Chrome) against dev server
npm run build          # typecheck + production build
npm run db:start       # supabase start (Docker)   · npm run db:reset — reapply migrations + seed
```

## Supabase
- Canonical schema = `supabase/migrations/*.sql` (schema → RLS → seed foods). Never change the DB by hand.
- Browser uses only `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` (legacy `VITE_SUPABASE_ANON_KEY` accepted).
  `lib/env.ts` refuses secret/service-role keys. Secrets (e.g. `FDC_API_KEY`) live only in Edge Function secrets.
- Missing env vars ⇒ Offline/Local mode, never a crash. "Connected to Supabase" only after a verified request.
- RLS on every user table: own rows only, `with check (user_id = (select auth.uid()))`. System foods: `created_by is null`, read-only.

## Verification rules
- Don't claim something works until it ran: tests, build, DB tests, browser checks.
- Never weaken/skip tests (`.only`, `.skip`, deleted assertions) to get green. Fix root causes.
- Before finishing a change: `npm run typecheck && npm run lint && npm test`; for DB changes also `npm run test:db`.
- Keep docs (README, docs/*) consistent with the actual implementation.
