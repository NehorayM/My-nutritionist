# My-nutritionist

A mobile-first nutrition and wellness web app that adapts to what you actually eat. Log real meals, see where
today stands, get practical suggestions for the rest of the day, and track weight and weekly activity against your
own plan. It works fully offline as a guest and syncs to Supabase when configured.

> Wellness assistant, not medical advice. Targets and suggestions are general estimates. People under 18 get
> general wellness targets only.

## Features

| Tab | What it does |
|---|---|
| **Meals** | Day view with calorie ring, macro bars and **micronutrient coverage** (missing data shown, never zero-filled). Breakfast, lunch, dinner and snacks cards with add, edit, delete (Undo), "Repeat yesterday" and "Save as meal". Add Food has five tabs: debounced search over the bundled USDA-sourced catalog and your foods, USDA FoodData Central when signed in, and an explicit Open Food Facts packaged-product search and barcode lookup. The other tabs are Recent, Favorites, Saved meals and Custom foods. **Smart options for the rest of today** come from the Adaptive Nutrition Engine. You can log them to any meal, save them, dismiss them (with Undo), or ask for other options. |
| **Progress** | Quick morning weigh-in (kg/lb). Stats include current, weekly change, total change, distance to goal and trend. The chart has 7-day, 30-day and all-time ranges, with a 7-day moving-average trend and a safe target trajectory for adults only, plus an accessible data table. History with edit and delete, goal settings, and an in-app reminder. |
| **Activity** | Weekly plan (strength/cardio sessions), workout log with an informational MET estimate, weekly progress and adherence. **Smart Catch-Up** suggestions respect recovery spacing; you can accept and schedule them, complete, dismiss, or see another option. |
| **Profile** | Sign up, sign in, sign out and password reset (Supabase Auth), or guest mode. **Personal Profile**, food preferences (diet pattern, allergies, dislikes, cuisines, prep time), goals, weekly plan, units, theme and reminders. Connection status shows "Connected to Supabase" only after a verified request, or "Running in Offline/Local Mode". It also shows pending synchronization and failed changes with retry/discard, guest-data import, "How targets are calculated", and JSON export. |

## Quick start (guest / offline mode)

```bash
npm install
npm run dev            # http://localhost:5173
```

Without Supabase variables the app runs in **Offline/Local mode**: everything is stored in IndexedDB on this device,
and supabase-js isn't even downloaded.

## Cloud mode with the local Supabase stack

```bash
npm run db:start                      # Docker: Postgres, Auth, REST, Edge Runtime (migrations + seed applied)
npx supabase status -o env            # copy API_URL and PUBLISHABLE_KEY
cp .env.example .env.local            # set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY
npm run dev
```

Only the project URL and the **publishable** key belong in the browser. Secret/service-role keys and `FDC_API_KEY`
must never be in a `VITE_*` variable; the app refuses secret keys. Hosted setup, Auth settings, Edge Function
deployment and RLS testing are covered in [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md).

## Deploy to GitHub Pages

The workflow `.github/workflows/deploy-pages.yml` builds and publishes the app on every push to `main`.
One-time setup in the repository: **Settings → Pages → Build and deployment → Source: GitHub Actions** (leave the
custom domain empty unless you own a domain). The site is then served at `https://<user>.github.io/<repo>/`
in Offline/Local mode. For accounts, create a hosted Supabase project (see docs/SUPABASE_SETUP.md), add repository
variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (Settings → Secrets and variables → Actions →
Variables), and add the Pages URL to Supabase Auth redirect URLs.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` / `npm run preview` | Dev server / preview the production build |
| `npm run build` | Typecheck (`tsc -b`) and production build |
| `npm run typecheck` · `npm run lint` | TypeScript project references · oxlint |
| `npm test` · `npm run test:coverage` | Unit + integration tests (Vitest, jsdom) · with v8 coverage |
| `npm run test:db` | RLS/security/constraint tests against the local Supabase stack + Edge Function tests |
| `npm run test:e2e` | Playwright (system Chrome): guest flow, and signed-in flow when the local stack runs |
| `npm run db:start` · `db:stop` · `db:reset` · `db:types` | Local Supabase lifecycle and type generation |
| `npm run seed:sql` | Regenerate `supabase/migrations/003_seed_foods.sql` from `src/data/system-foods.json` |

## Project structure

```
src/
  app/            shell, bottom nav, hash routing, session gate, error boundaries
  components/ui/  design-system primitives (Radix Dialog sheets, fields, progress, toasts…)
  features/       meals · progress · activity · profile · onboarding (screens, components, hooks)
  domain/         pure engines: nutrition, adaptive, weight, activity; dates, units, nutrients
  stores/         Zustand stores (one per concern) + derived hooks
  repositories/   interfaces + local (IndexedDB) · supabase · synced (cache + outbox) implementations
  services/       food providers & search, sync engine, auth, session, guest migration
  schemas/        Zod schemas and limits mirroring the database checks
  data/           USDA-sourced system food catalog (70 foods) and SQL seed generator
  lib/            env, lazy Supabase client, ids, logger, formatting, notifications
supabase/
  migrations/     001 schema · 002 RLS + grants · 003 seed foods (generated)
  functions/      food-search Edge Function (USDA proxy) + shared USDA normalization
  tests/database/ pgTAP policy tests
tests/
  db/             security tests against the local stack
  e2e/            Playwright flows
docs/             product spec, architecture, design system, Supabase setup, food data, testing
```

## Documentation

- [docs/PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md): product behavior and tone
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): layers, engines, data model, sync, decisions
- [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md): tokens and components
- [docs/FOOD_DATA_SOURCES.md](docs/FOOD_DATA_SOURCES.md): provider evaluation, licensing, normalization
- [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md): local and hosted setup, security model
- [docs/TESTING.md](docs/TESTING.md): test layers, coverage, limitations
- [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md): phases and acceptance criteria

## Data and licensing

System foods come from **USDA FoodData Central** (SR Legacy, FNDDS; public domain). Packaged products come from
**Open Food Facts** (Open Database License), with attribution shown in the app. Activity estimates use the 2024 Adult
Compendium of Physical Activities and are informational only. They never change food targets.

## Requirements

Node ≥ 22 (developed on Node 24 LTS), a modern browser. Docker for the local Supabase stack and Google Chrome for
end-to-end tests.
