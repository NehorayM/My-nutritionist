# Implementation plan

Each phase lists dependencies and acceptance criteria. A phase is done only when its tests pass, the build passes,
and behavior was exercised (unit/integration/browser as relevant). **Status: all phases A–O complete** (see
docs/TESTING.md for what was verified and how).

| # | Phase | Depends on | Acceptance criteria |
|---|---|---|---|
| A | Environment & research | — | Node LTS installed; current docs for Vite/Tailwind/Vitest/Supabase/food APIs reviewed; findings recorded |
| B | Scaffold & tooling | A | Vite React-TS template, Tailwind 4 plugin, strict TS, Vitest/RTL, oxlint, Playwright, Supabase CLI config |
| C | Contracts | B | Domain types, engine output types, repository + provider interfaces, env/supabase wrapper, dates/units with tests |
| D | Domain engines | C | Target, portion, aggregation, remaining, coverage, adaptive (candidates/allocation/ranking/builder), weight, activity/catch-up — near-complete branch coverage, edge cases from the spec |
| E | Seed catalog | C | ≥60 USDA-sourced foods (per-100 g, nulls for unknown), deterministic ids, allergen/diet/prep metadata, generated SQL seed |
| F | Supabase backend | C, E | Migrations (schema, RLS, seed), grants, stale-write trigger, Edge Function `food-search`; DB tests prove allow/deny/ownership-spoofing cases on the local stack |
| G | Data layer | C | IndexedDB repos, Supabase repos + row mappers + Zod validation, outbox & sync engine, connectivity check, synced repos, guest migration — unit/integration tests incl. offline → reconnect |
| H | Food providers | C, E | Local catalog search, Open Food Facts + USDA providers with normalization, timeouts, rate-limit handling, caching, pagination; tests with fixtures |
| I | Design system & shell | B | Tokens, primitives (button, card, field, sheet, dialog, badge, progress, segmented, empty/error/loading), toasts, bottom nav, hash tabs, theme |
| J | Session, auth & Profile | G, I | Bootstrap/mode selection, Supabase Auth flows, guest mode, Personal Profile forms with validation, connection status, migration UI |
| K | Meals | D, G, H, I, J | Day view, meal cards, add/edit/delete, search flow, custom foods, favorites/recent/saved meals, nutrition visuals, recommendations with actions |
| L | Progress | D, G, I, J | Weigh-in, history, goal settings, chart ranges with trend/trajectory, stats, table alternative |
| M | Activity | D, G, I, J | Workout log, weekly progress, Smart Catch-Up actions, scheduled sessions |
| N | Integration & E2E | J–M | Critical guest + authenticated flows in Playwright; RTL integration flows; refresh persistence |
| O | Audit & polish | N | Security audit (secrets, RLS, inputs), a11y, responsive checks, docs accuracy, final build/test runs |
