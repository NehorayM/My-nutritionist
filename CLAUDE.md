# My-nutritionist — engineering guide

Mobile-first nutrition & wellness web app: log real meals, see today's nutrition, get adaptive
suggestions for the rest of the day, track weight and weekly activity. Wellness assistant —
**not** a medical tool. Works fully offline (guest/local mode) and syncs to Supabase when configured.

## Stack
Vite 8 · React 19 · TypeScript 6 (strict, `noUncheckedIndexedAccess`, `erasableSyntaxOnly`) ·
Tailwind CSS 4 (`@tailwindcss/vite`, tokens in `src/app/styles/tokens.css`) · Zustand 5 · Zod 4 · Recharts 3 ·
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
- supabase-js and cloud-only code (`services/session/cloudDeps.ts` → auth, sync, migration) load lazily, only when
  Supabase is configured. Don't import them statically from guest-mode code (check with `npm run build` chunk sizes).
- Recommendations never suggest "occasional" foods (fast food, sweets, sugary drinks, chips) unless favorited;
  logging is unaffected (`domain/adaptive/candidates.ts`).

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
npm run seed:sql       # regenerate supabase/migrations/003_seed_foods.sql from src/data/system-foods.json
```
Local cloud mode: `.env.local` (gitignored; Vitest ignores it via `test.env`) with the local stack's `API_URL` + `PUBLISHABLE_KEY` from
`npx supabase status -o env`. Delete it to run in guest mode.

## Deployment (GitHub Pages)
- Repo: https://github.com/NehorayM/My-nutritionist · site: https://nehoraym.github.io/My-nutritionist/
- `.github/workflows/deploy-pages.yml` runs typecheck, lint and tests, then `npm run build -- --base=/<repo>/`
  and publishes `dist/` on every push to `main` (or manually via "Run workflow"). Pages source must be "GitHub Actions".
- Hash routing (`#/meals`…) means no SPA 404 fallback is needed. Public assets must use relative/`base`-aware paths
  (see `public/manifest.webmanifest`).
- Cloud mode on Pages: repository **variables** `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are set
  (Settings → Secrets and variables → Actions → Variables). Never put secret keys there.

## Hosted Supabase (production)
- Project `my-nutritionist`, ref `ucboymoqcfllaoobdcgd` (eu-west-1); the CLI is linked (`npx supabase link`).
- Schema changes: add a new migration in `supabase/migrations/` (never edit applied ones), test locally
  (`npm run db:reset && npm run test:db`), then `npx supabase db push --dry-run` and `npx supabase db push`.
  Check `npx supabase db advisors --linked --type all` afterwards.
- Edge Function: `npx supabase functions deploy food-search --project-ref ucboymoqcfllaoobdcgd --use-api`.
  Secret `FDC_API_KEY` is currently USDA's rate-limited `DEMO_KEY` (replace with a real api.data.gov key).
- Auth: Site URL / redirect URLs point to the Pages URL (+ `http://localhost:5173/**`); email confirmation is set in
  the dashboard (built-in email only reaches org members — use custom SMTP before inviting others).

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
- Keep this CLAUDE.md up to date with every change to commands, architecture, conventions or deployment.
