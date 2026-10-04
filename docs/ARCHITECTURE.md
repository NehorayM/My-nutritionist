# Architecture

## Layers

```
features/* (React screens & components)
   │  read state / call actions                     ▲ derived values via domain/* (pure)
   ▼                                                │
stores/* (Zustand, one store per concern) ──────────┘
   │  async actions
   ▼
services/runtime.ts → Repositories (interfaces in repositories/types.ts)
   │                         ├─ local/*    IndexedDB (guest mode, and cache in cloud mode)
   │                         ├─ supabase/* PostgREST via supabase-js (authoritative in cloud mode)
   │                         └─ synced/*   cloud mode: local cache + outbox + Supabase
services/food/*  FoodSearchService → FoodProvider (local catalog | Open Food Facts | USDA via Edge Function)
services/sync/*  outbox, sync engine, connectivity
services/auth/*  Supabase Auth wrapper, guest → account migration
lib/*            supabase client wrapper, env, ids, logger, cn, format
domain/*         pure engines (nutrition, adaptive, weight, activity), dates, units, nutrients
```

Rules: UI never imports `lib/supabase`, `idb`, or provider formats. `domain/*` never imports React, stores,
repositories or `Date.now()` — time is passed in. Stores hold *source* data (entries, profile, workouts);
everything derived (totals, targets, remaining, recommendations, chart series, weekly progress) is computed
with domain functions in selectors/hooks (`useMemo`) — no duplicated derived state.

## Runtime modes

| Mode | When | Repositories | Status label |
|---|---|---|---|
| guest | no Supabase config, or user picks "Continue as guest" | `createLocalRepositories(guestId)` (IndexedDB) | "Running in Offline/Local Mode" |
| cloud | Supabase configured **and** signed in | `createSyncedRepositories(userId)` = local cache + outbox + Supabase | "Connected to Supabase" only after a verified request |

`guestId` is a random UUID persisted in `localStorage` (`mn.guestId`). Bootstrap (`app/bootstrap.ts`)
picks the mode, builds repositories, calls `services/runtime.setRepositories()`, then stores load.

## Domain engine APIs (pure, deterministic, unit-tested)

`domain/nutrition/`
- `targets.ts` — **Daily Target Engine**: `calculateDailyTargets({ profile, date, latestWeightKg }): DailyTargets`.
  Separates physiological estimate (Mifflin-St Jeor BMR × activity factor) → product goal (moderate, capped
  adjustment; none for minors / incomplete profiles / general wellness) → nutrient targets (macros by diet pattern,
  fiber 14 g/1000 kcal, micronutrient RDA/AI by age & sex, limits for sodium and saturated fat; total sugars are display-only because guidelines limit *added* sugars, which food data can't distinguish). Constants in `constants.ts` with sources.
- `portion.ts` — **Food Nutrient Calculation Engine**: `scaleNutrients(per100g, grams)`, `portionNutrients(portion)`,
  `gramsForQuantity(quantity, servingGrams)`. `nutrient = per100g × grams / 100`; null stays null.
- `aggregation.ts` — **Nutrient Aggregation Engine**: `sumNutrientProfiles(profiles)`, `totalsForPortions(portions)`,
  `aggregateDay(date, entries): DayTotals`, `totalsToProfile(totals)`.
- `remaining.ts` — **Remaining Nutrition Engine**: `calculateRemaining({ targets, totals, entries, now, date }): RemainingNutrition`
  (statuses, gaps, surpluses, remaining meal slots).
- `coverage.ts` — `micronutrientCoverage(targets, totals, items?): MicronutrientCoverage` (transparent about missing data).

`domain/adaptive/` — **Adaptive Nutrition Engine** (`engine.ts: buildAdaptivePlan(input: AdaptiveInput): AdaptivePlan`)
- `diets.ts` diet-pattern rules (compatibility + macro emphasis), extensible per `DietType`.
- `candidates.ts` — **Recommendation Candidate Engine**: filters by allergies (unknown allergen info excluded when the
  user has allergies), diet (unknown flags excluded for vegetarian/vegan), dislikes, meal compatibility, prep time.
- `allocation.ts` — **Meal Allocation Engine**: splits the remaining day across remaining meal slots → `MealBudget`.
- `ranking.ts` — **Recommendation Ranking Engine**: multi-dimension score (calorie fit, macro fit, fiber,
  micronutrients, preference, practicality, variety). Never ranks on a single nutrient.
- `builder.ts` composes 1–3 food meal options per style with realistic portions; `explanations.ts` neutral one-liners.

`domain/weight/` (barrel `index.ts`): `selectDailyWeights(entries)` (same-day rule: **earliest measurement of the local day** —
the morning weigh-in — ties broken by id), `movingAverage(daily, windowDays)`, `computeWeightStats(entries, { targetWeightKg, today })`,
`weightGoalInput(profile, today)`, `calculateTrajectory(...)` (adults only, safe capped rates), and
`buildWeightChart(entries, { range, today, trajectory: WeightGoalInput | null, projectDays? })` (projection only for a safe goal).

`domain/activity/`: `getWeekWindow(today, weekStartsOn)`, `categoryOf(type)`, `computeWeeklyProgress({ workouts, plan, today })`,
`planCatchUp({ progress, recentWorkouts, scheduled, preferredMinutes, dismissedIds, variant })` (**Smart Catch-Up**:
recovery spacing, no stacking, caps per day), `estimateWorkoutKcal({ type, intensity, durationMin, weightKg })` (MET-based, informational).

## Data model & persistence

All records: client UUID `id`, owner `userId`, `createdAt`, `updatedAt` (ISO). Meal entries embed a `FoodPortion`
snapshot (name, brand, source, external id, quantity, serving, grams, `per100g`) so history stays auditable.
System foods use deterministic UUIDv5 ids (`lib/id.ts`) shared by the bundled catalog and the `food_items` seed.
Saved provider foods get `userFoodId(userId, source, externalId)` so re-saving never duplicates.

### Supabase tables (source of truth in cloud mode)
| Table | Owner column | Notes |
|---|---|---|
| profiles | id (= auth.users.id) | Personal Profile, preferences, activity targets, units |
| food_items | created_by (NULL = system) | system catalog (read-only to clients) + user custom/saved provider foods |
| meal_logs | user_id | nutrition snapshot (`nutrients_per_100g` jsonb) + grams/quantity/serving |
| weight_logs | user_id | canonical kg + entered unit, local date + timestamp |
| workout_logs | user_id | type, duration, intensity, informational kcal |
| scheduled_workouts | user_id | accepted catch-up / planned sessions |
| favorites | user_id | references food_items (system or own) |
| saved_meals | user_id | meal templates (items jsonb of FoodPortion) |

Stale-write guard: a `BEFORE UPDATE` trigger skips updates whose `updated_at` is older than the stored row, so a
delayed offline mutation can never overwrite newer data. `updated_at` is clamped to `now() + 5 min` against clock skew.

### Local persistence
IndexedDB database `my-nutritionist` (via `idb`): one object store per entity (indexed by `userId`, and
`[userId, date]` where relevant) plus `outbox`. Guest mode: authoritative local data. Cloud mode: cache only.

## Sync (cloud mode)
Write: apply to local cache → enqueue `OutboxMutation` (coalesced per record: a newer upsert replaces a pending one,
a delete replaces a pending upsert) → flush. Flush: FIFO per user (keeps FK order: food before favorite), upsert by
id (idempotent → no duplicates on retry), delete by id. Network/5xx errors → keep, exponential backoff (2 s → 5 min),
retry on `online` event / reconnect. 4xx (validation/RLS) → mark `failed`, surface in Profile with Retry/Discard.
Read: fetch from Supabase when reachable, refresh cache, overlay pending local mutations; when unreachable serve cache.
Conflicts: last writer by `updated_at` wins per record (enforced server-side by the stale-write trigger); deletes win.

## Guest → account migration
After sign-in, if the device holds guest records, Profile offers "Import N local items". Records are re-keyed to the
user id (saved provider foods re-derive their ids and references are remapped), pushed via the outbox, and guest data is
cleared only after every mutation is acknowledged. Nothing is discarded silently.

## Food data
See docs/FOOD_DATA_SOURCES.md. Providers: local catalog (bundled USDA-sourced seed + user foods; instant,
search-as-you-type with a 350 ms UI debounce), USDA FoodData Central via the `food-search` Edge Function (API key stays
server-side; cloud mode only; normalization shared in `supabase/functions/_shared/usda/normalize.ts`), and Open Food Facts
browser-direct (keyless, CORS `*`) for **barcode lookup** and an **explicit "Search packaged products" action** — never
search-as-you-type, because OFF allows 10 searches/min per IP. `FoodSearchService` caches (LRU+TTL), times out (8 s),
paginates, rate-limits OFF client-side, and returns partial results with per-provider errors.

## Decisions
| Decision | Reason |
|---|---|
| No manual chunking; React.lazy routes split recharts | Vite 8 (Rolldown) manual groups pulled React into the charts chunk and loaded it eagerly |
| Hash-based tab navigation, no router library | 4 tabs + auth callback; keeps bundle small; deep links & refresh work |
| IndexedDB (idb) over localStorage | multi-year logs exceed localStorage quotas; async, indexed queries |
| Client-generated UUIDs | idempotent retries, offline creation, no temp-id remapping |
| Snapshot nutrients in meal logs | history stays correct when provider data changes |
| Stale-write trigger in DB | conflict rule enforced where the data lives; simple for single-user app |
| USDA through Edge Function, OFF direct (explicit search only) | USDA needs an API key (secret); OFF is keyless and CORS-enabled, but per-IP limits (10 searches/min) rule out search-as-you-type and proxying (shared egress IP) |
| Radix Dialog for sheets/dialogs | accessible focus management with tiny footprint; no full component kit needed |
| oxlint (template default) instead of ESLint | official create-vite template; typescript-eslint doesn't support TS 7 track |
| TypeScript 6.0 (template pin) | TS 7 native compiler is new and unsupported by lint tooling |
| Earliest same-day weigh-in for charts | morning weigh-ins are the most comparable; documented & tested |
