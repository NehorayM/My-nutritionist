# Testing

## Test layers

| Layer | Where | Runs on | Command |
|---|---|---|---|
| Domain engines (unit) | `src/domain/**/*.test.ts` | Vitest + jsdom | `npm test` |
| Stores, repositories, sync, services (unit/integration) | `src/{stores,repositories,services,schemas,lib}/**/*.test.ts` | Vitest + jsdom + fake-indexeddb | `npm test` |
| UI flows (integration) | `src/features/**/*.test.tsx`, `src/app`, `src/components` | React Testing Library + user-event against real IndexedDB repositories (fake-indexeddb) | `npm test` |
| Database security & constraints | `tests/db/*.test.ts` | Vitest (node) against the **local Supabase stack**, two real users | `npm run test:db` |
| Edge Function (`food-search`) | `tests/db/functions/*.test.ts` | Vitest (node), fake upstream | `npm run test:db` |
| Database policies (pgTAP) | `supabase/tests/database/*.test.sql` | Postgres in the local stack | `npx supabase test db` |
| End-to-end | `tests/e2e/*.spec.ts` | Playwright in the system Google Chrome | `npm run test:e2e` |

Prerequisites: Node 24 (`~/.local/bin`), Docker for the local Supabase stack (`npm run db:start`), Google Chrome at
`/usr/bin/google-chrome` for Playwright (no browser download). The `cloud` E2E project and `test:db` need the local
stack running; without it Playwright runs only the `guest` project.

## What is covered

- **Nutrition engines** — calorie/macro calculation, gram scaling (0.1 g … 5000 g), micronutrient aggregation,
  unknown values stay `null` with known/missing counts, daily and per-meal totals, remaining targets and statuses,
  remaining meals by time of day, targets for adults/minors/incomplete profiles/each goal, pace and diet, floors.
- **Adaptive Nutrition Engine** — balanced day, calorie surplus (large pizza day), protein/fiber/iron/vitamin C gaps
  (judged against each meal's nutrient budget), allergies incl. unknown allergen data, vegetarian/vegan/keto,
  restrictive diet + allergy, dislikes, occasional foods only when favorited, prep time and cooking skill, ranking
  balance, variety, dismissals, deterministic variants, empty candidate set, past day, neutral vocabulary guard,
  performance budget.
- **Weight engine** — empty/one/many values, earliest same-day rule, unordered input, missing dates, irregular
  intervals, moving-average window boundaries, weekly/total change, goal distance, trend, safe trajectory caps, minors.
- **Activity engine & Smart Catch-Up** — no activity, met/exceeded targets, behind early/late in the week, no remaining
  days, recovery spacing (incl. across week boundaries), one session per day, deferred sessions, scheduled sessions,
  dismissals, variants, plan changed midweek, week start Sunday/Monday, MET estimates.
- **Data layer & sync** — Zod schemas mirror DB checks (parsed from the migration), IndexedDB repositories with user
  isolation, Supabase row mappers and error classification, outbox coalescing and FIFO, single-flight sync with
  backoff, 4xx → failed with retry/discard, reconnect flush, synced reads (cache offline, pending writes win), guest →
  account import (re-keying, id remapping, failure keeps guest data), auth error mapping, session controller
  (guest/cloud/welcome, racing auth events, expired session, sign-out cache rules, password recovery).
- **Food providers** — USDA and Open Food Facts normalization from real response samples (unit conversions, nulls,
  servings, allergens, diet flags), local search ranking and aliases, rate limiting, timeouts, aborts, partial results,
  caching, pagination, barcode lookup.
- **UI flows** — search → select → grams/serving → log; edit; delete + undo; repeat yesterday; custom foods; favorites;
  saved meals; recommendations log/save/dismiss/undo; weigh-ins with imperial units, chart ranges, history, goals;
  workouts, weekly plan, catch-up scheduling; Personal Profile, preferences, connection status, guest import.
- **Database security** (`test:db`, 221 tests) — RLS enabled on every table; anon cannot read/write user data; anon can
  read system foods only; user A cannot read, insert for, update, delete or re-assign user B's rows; no client writes
  to system foods; foreign references to another user's food are rejected; CHECK constraints; stale-write guard;
  cascade on user deletion; seed consistency.
- **End-to-end** — guest: open → profile → log a day (incl. a large pizza) → totals → smart options → weigh-in →
  workout → refresh → everything persists, no console errors. Signed in (local Supabase): sign up → profile → add,
  edit, delete foods → weigh-in → weekly target → workout → Smart Catch-Up → refresh → sign out (cache removed) →
  sign in → data restored from Supabase, no console errors.

## Coverage

`npm run test:coverage` (v8, 6 workers). Last measured: statements 93.7 %, branches 88.7 %, functions 93.6 %,
lines 95.0 % overall. Domain engines: nutrition, weight, activity, adaptive and dates at 100 % statements/branches.

## Conventions

- `.only`/`.skip` are lint errors (oxlint `vitest/no-focused-tests`, `no-disabled-tests`).
- Domain tests pass time in explicitly; UI tests fix the clock with `vi.setSystemTime` (Date only).
- UI tests use real local repositories (fake-indexeddb), not mocked stores; remote providers and auth are faked at
  their interfaces.
- Long UI flows: `testTimeout` 20 s and RTL `asyncUtilTimeout` 4 s, because jsdom under full parallel load is slow;
  assertions are unchanged. The adaptive planner's performance budget is 100 ms (real cost ≈ 2 ms) so coverage
  instrumentation cannot make it flaky.

## Known limitations

- Live USDA calls were verified manually against the local Edge Function with `DEMO_KEY`; automated tests use recorded
  responses. Open Food Facts is exercised with recorded responses only (its rate limits forbid CI traffic).
- The local stack auto-confirms emails, so the email-confirmation and password-reset *email links* are covered by unit
  tests of the auth service and controller, not by E2E.
