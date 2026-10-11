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
  user has allergies), diet (unknown flags excluded for vegetarian/vegan), dislikes (name, category, tags, and the
  fish/shellfish food groups), meal compatibility, prep time. Occasional foods only when favorited; condiments and
  alcohol (catalog tags `condiment`, `alcohol`) are never suggested — the kitchen planner skips them too.
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
Conflicts: last writer by `updated_at` wins per record (enforced server-side by the stale-write trigger). A deleted
record comes back only with a newer version (Undo); an older queued edit can't resurrect it (tombstones, migration 004).

### Sync integrity (audit, 2026-10)
- **Server outcome reconciliation** — `RemoteTable.write` reports `applied | superseded | deleted`. When the server kept
  another version (newer write elsewhere, clamped clock, tombstone) the sync pass copies it into the cache in the
  same IndexedDB transaction as the acknowledgement (unless a newer local change is queued) and emits `reconciled`.
- **One sender per user across tabs** — each pass runs under a Web Lock (`my-nutritionist:sync:<user>`), so two tabs
  never send versions of one record concurrently (`services/sync/locks.ts`).
- **Stores never lose local changes to slow loads** — every store records its optimistic changes in a
  `ChangeJournal` and overlays them on load results that started earlier; rollbacks are per record.
- **No data across sessions** — `resetUserStores()` starts a new session epoch; async results of an older epoch
  are dropped (`sessionGuard()` in `stores/registry.ts`).
- **Live refresh** (`services/session/liveRefresh.ts`): this tab's writes are announced to other tabs (BroadcastChannel,
  `services/dataEvents.ts`); the server announces changes of the signed-in user over a private Realtime topic
  (`user:<id>`, broadcast by a database trigger — table names only, never row data); a tab that was hidden ≥ 30 s,
  a reconnect or a Realtime re-subscribe reloads everything. Bursts are coalesced (250 ms) into one reload per store.

## Hebrew search translation (`services/translation`)
Hebrew queries are put into English before any provider is asked: a built-in food dictionary (≈ 530 phrases, prefix
and plural/construct-form variants, describing words moved in front: "חזה עוף צלוי" → "roasted chicken breast")
answers instantly and offline; words it doesn't know are machine-translated (MyMemory, only when online, cached per
session). Local search runs on both texts (the user's own foods may have Hebrew names); USDA and Open Food Facts only
ever receive English. `FoodSearchResult.translation` drives the "Searching in English for …" note.

## Session & auth (`services/session`)
`SessionGate` calls `startSession()` once. Without Supabase config → guest mode immediately. With config, the
controller creates the Supabase client and subscribes to auth events in the same tick (so `PASSWORD_RECOVERY` is
never missed), processes email links (`completeRedirect`), verifies connectivity with a real request, then restores
the stored session (cloud mode), honors a remembered guest choice, or shows the welcome screen. All transitions are
serialized. Signing out removes the user's cached records from the device unless changes are still waiting to sync;
an unexpected sign-out (expired session) keeps them and shows a notice. Sync status, connectivity and the guest-import
offer live in `stores/syncStore`; successful syncs are only announced after an offline/error period.

## Guest → account migration (`services/migration`)
After sign-in, if the device holds guest records, Profile offers "Import N local items". Records are re-keyed to the
user id (saved provider foods re-derive their ids and references are remapped), saved through the synced repositories
(local cache + outbox), and guest data is cleared once every record is stored for the account — rejected server writes
stay visible with Retry/Discard, so nothing is discarded silently. The account's existing profile is never
overwritten (checked against the server). If an import stops part-way, records that kept their ids already belong to
the account and the rest stay with the guest; running the import again completes it.

## Kitchen & meal planner (`domain/planner`, `features/kitchen`)
Pantry items (`pantry_items`) snapshot the food and say how it is eaten: `ready`, `reheat` (needs one of its
`methods`) or `cook` (needs cooking allowed, a method and `cookMinutes`). Planner settings (`planner_settings`, one per
user) hold equipment for the whole day or per meal, and per meal: enabled, can cook, minutes, kcal range; plus a
daily kcal range (empty → the nutrition targets ±10 %). `planMeals()` is pure and deterministic:
1. items that can never be planned are set aside with a reason (unknown kcal, expired, used up, occasional food that is
   not a favorite, allergens incl. unknown allergen data, diet);
2. per enabled meal: items its equipment/cooking/time allow → combinations of 1–4 items (1–2 for snacks, best 4 per
   plate role) → realistic portions sized into the meal's kcal range (never more than is at home) → scored (fit,
   protein, plate balance, fiber, prep time, meal-time fit, use-soon);
3. one option per meal is combined (exhaustive search over the top 8) so the day never uses more of an item than is at
   home and lands in the daily range when possible (`fits`). Meals without an option report why (`gap`).
A seeded property test checks every option and day plan against all rules on 150 random kitchens.

## Email reminders (`reminder_schedules`, `supabase/functions/reminders`)
Schedules are synced records (kind, meal, local time, weekdays, IANA time zone, skip-if-logged). Every 5 minutes
pg_cron → `private.invoke_reminders()` (pg_net) → Edge Function `/reminders/dispatch` (shared secret) →
`claim_due_reminders()` inserts one `reminder_dispatches` row per (schedule, local day) and claims due rows with
`for update skip locked` → emails via Resend (production) or Mailpit (local) with one-click unsubscribe headers and a
signed unsubscribe link (`#/unsubscribe?token=…`, HMAC) → outcome recorded (`sent`, `skipped` with a reason, or
`failed` → retried up to 3 attempts while timely). Delivery rows are read-only for their owner and announced over
Realtime, so Profile shows "sent" live. `/reminders/test` sends a test email to the signed-in user (JWT, 1/min).

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
| Lazy loading: Progress/Activity/Profile routes, supabase-js + cloud services only when configured; no manual chunking | Vite 8 (Rolldown) manual groups pulled React into the charts chunk and loaded it eagerly |
| Hash-based tab navigation, no router library | 5 tabs + auth callback + unsubscribe links; keeps bundle small; deep links & refresh work |
| IndexedDB (idb) over localStorage | multi-year logs exceed localStorage quotas; async, indexed queries |
| Client-generated UUIDs | idempotent retries, offline creation, no temp-id remapping |
| Snapshot nutrients in meal logs | history stays correct when provider data changes |
| Stale-write trigger in DB | conflict rule enforced where the data lives; simple for single-user app |
| USDA through Edge Function, OFF direct (explicit search only) | USDA needs an API key (secret); OFF is keyless and CORS-enabled, but per-IP limits (10 searches/min) rule out search-as-you-type and proxying (shared egress IP) |
| Radix Dialog for sheets/dialogs | accessible focus management with tiny footprint; no full component kit needed |
| oxlint (template default) instead of ESLint | official create-vite template; typescript-eslint doesn't support TS 7 track |
| TypeScript 6.0 (template pin) | TS 7 native compiler is new and unsupported by lint tooling |
| Earliest same-day weigh-in for charts | morning weigh-ins are the most comparable; documented & tested |
