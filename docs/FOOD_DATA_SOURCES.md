# Food data sources

How My-nutritionist finds foods, which external databases it uses, and why. Research verified against the
official documentation and live responses on 2026-10-03 (samples and notes are kept out of the repo).
Code: `src/services/food/` and `supabase/functions/_shared/usda/` (USDA mapping shared with the Edge Function).

## Providers at a glance

| Provider | Used for | Where it runs | Available in |
|---|---|---|---|
| **Local catalog** | Search-as-you-type over the bundled system catalog (USDA-sourced, `src/data/systemFoods.ts`) and the user's own foods; barcode match for saved products | Browser, in memory | Guest and cloud mode, offline |
| **USDA FoodData Central** | Generic foods (Foundation, SR Legacy, Survey/FNDDS) while typing; branded US products on request | `food-search` Supabase Edge Function (API key server-side) | Cloud mode (signed in) |
| **Open Food Facts (OFF)** | Barcode lookup; explicit "Search packaged products" action | Browser-direct (keyless, CORS `*`) | Guest and cloud mode, online |

## Evaluation

| Criterion | USDA FoodData Central | Open Food Facts | Israeli MoH nutrition DB | FatSecret Basic | Edamam | Nutritionix |
|---|---|---|---|---|---|---|
| Coverage | US. Foundation, SR Legacy (~7.8k), FNDDS, Branded (hundreds of thousands) | Global crowd-sourced packaged products, incl. Israeli brands | ~4,500 foods + ~1,400 Israeli recipes | US only | ~1M foods | US |
| Generic vs branded | Excellent generic; branded = US label data | Packaged only | Generic + some label data | Both | Both | Both |
| Barcode | No lookup endpoint (GTIN is a searchable field) | Yes: `/api/v2/product/{code}` | No | Yes | Yes | Yes |
| Micronutrients (iron, calcium, vit C, vit D, potassium) | Full for generic; label subset for branded (vit D often in IU) | Sparse, label-dependent; values in grams | 74 nutrients | Partial | 28 basic | Partial |
| Limits | 1,000 req/h per key; 429 blocks the key for 1 h; CORS preflights count | 15 product reads/min/IP, **10 searches/min/IP**, abusive IPs banned, global 503s | none (bulk files) | 5,000/day | 50–300/min (paid) | no public tier |
| Auth / keys | api.data.gov key — must stay secret (published keys are deactivated) | None; identify the app via (X-)User-Agent | None | OAuth2 + IP allow-list | app id/key | app id/key |
| Licensing | Public domain (CC0); citation requested | ODbL (database), DbCL (contents), CC BY-SA (images) | Open government licence | Proprietary, attribution | Proprietary, caching restricted to 4 macros | Proprietary |
| Reliability (measured) | 1.2–1.7 s search; full Foundation detail up to 16 s / 2.5 MB unfiltered | 0.3–0.6 s; data quality varies (dirty tags, estimated values) | 0.4 s, data from 2022 | not tested | not tested | not reachable |
| Response structure | 3 shapes (search / full / abridged) with different unit casing and nutrient keys | v2 flat `nutriments` (`*_100g`, grams); v3.6 `nutrition.aggregated_set` | flat CKAN rows | — | — | — |
| Caching | Allowed (CC0); no Cache-Control from upstream | Allowed with attribution + share-alike for derived databases | Allowed | ToS-restricted | 4 macros only | — |
| Our rate limiting | Edge Function in-memory LRU + client cool-down after 429 | Client token buckets (search 1 per 6 s; product 3 burst + 1 per 5 s) + client cache | Build-time import | — | — | — |

## Decisions

1. **USDA only through the Edge Function.** The api.data.gov key would be public in a browser bundle (and then
   deactivated), and the hourly quota is shared by all users. The function returns a normalized `UsdaFoodDto`
   (contract: `docs/contracts/food-search-function.md`) produced by `supabase/functions/_shared/usda/normalize.ts`,
   so the client never parses FoodData Central formats. Detail calls use `format=full&nutrients=<20 numbers>`
   (abridged has no nutrient ids, no branded serving and no portions; unfiltered full can be 2.5 MB).
2. **Generic USDA scope by default.** Unfiltered searches are flooded by branded duplicates ("cheddar cheese" →
   59,773 branded hits). `scope: 'branded'` is available through `search(text, { usdaScope: 'branded' })`.
3. **OFF browser-direct.** Its limits are per IP, so each user has their own budget; proxying would put every
   user behind Supabase's shared egress IPs. Requests send `X-User-Agent: My-nutritionist/1.0 (…)` because browsers
   cannot set `User-Agent` (OFF's CORS allow-list accepts `X-User-Agent`).
4. **OFF text search is never search-as-you-type.** OFF documents 10 searches/min/IP and warns that
   search-as-you-type gets clients blocked. It is an explicit action (`searchPackaged`) on the legacy
   `/cgi/search.pl` endpoint (the newer search-a-licious service has no CORS for our origin). A client token bucket
   allows one search per 6 s; when exhausted the call fails fast with `rate_limited` and `retryAfterMs`.
5. **OFF v2 product API**, not v3.6: v3.6 moved nutrition into `nutrition.aggregated_set` (marked as still in
   development) and returns an empty legacy `nutriments`. Parsing is isolated behind Zod schemas in
   `normalize/offSchema.ts` so a v3 parser can be added later.
6. **Israeli Ministry of Health data → build-time catalog import** (future), not a runtime API.
7. **Not integrated:** Nutritionix (no self-serve access), Edamam (paid; caching limited to 4 macros conflicts with
   nutrient snapshots in meal logs), FatSecret (needs a static-IP proxy; US-only free tier).

## Search behaviour (`FoodSearchService`)

- `search(text, { page, signal, usdaScope })`: local results always (20 per page), plus USDA (15 per page) when it
  is available and the trimmed query has ≥ 2 characters. Local results come first; remote results that duplicate
  a food already shown (same barcode ignoring leading zeros, same provider record — including the USDA record a
  catalog food was built from — or same normalized name + brand such as "Cheese, cheddar" ≡ "Cheddar cheese") are dropped. Remote duplicates of earlier local pages are dropped too.
- `onPartial` (option of `search`): called once with the local results while USDA is still answering (USDA status
  `pending`), so catalog and personal foods appear instantly in signed-in mode; "Load more" waits for the full result.
- `searchPackaged(text, { page, signal })`: Open Food Facts only, 15 per page, explicit user action.
- `lookupBarcode(code)`: user's saved products and the catalog first, then OFF. Results: `found` (with provider),
  `not_found`, `incomplete` (product exists but lacks a name or nutrition facts), `invalid_code`, `error`.
- `getDetails(food)`: loads the full USDA detail (all household portions) for a USDA search result.
- Every provider call gets its own `AbortController`, linked to the caller's signal, with an 8 s budget.
  Failures are isolated: the result carries `providerStatus` per provider (`ok`, `skipped`, or the error kind)
  and `errors` (with `retryAfterMs` when rate-limited). Aborting the caller's signal rejects with an `AbortError`.
- Successful remote answers are cached in an LRU (50 entries, 10 min) keyed by provider + operation + normalized
  query + page; errors are never cached; local results are never cached.
- Local ranking: exact name > same words in any order > name prefix > every query word matched (word or prefix)
  > partial word > substring. Shorter (more specific) names and a matching first word rank higher; the user's own
  foods get a boost within a tier. Accents, Hebrew niqqud, punctuation and plural/singular are folded, and spelling
  aliases are resolved (yoghurt/yogurt, chumus/humus/hummus, felafel/falafel, bourekas/burekas, pitta/pita,
  shwarma/shawarma, tehina/tahini, plus Hebrew spellings).

## Normalization rules

All providers produce `FoodItem` with nutrients **per 100 g** in app units (kcal; g for macros; mg for sodium,
potassium, calcium, iron, vitamin C; µg for vitamin D). **Unknown is `null`, never 0**; 0 only when the source
reports 0. Physically impossible values (e.g. > 1000 kcal or > 100 g of a macro per 100 g) become unknown.

| Topic | USDA (Edge Function) | Open Food Facts |
|---|---|---|
| Energy | 1008 kcal → 2048 → 2047 (Atwater) → 1062 kJ ÷ 4.184 | `energy-kcal_100g`, else `energy-kj_100g` ÷ 4.184 (`energy_100g` is kJ) |
| Minerals / vitamins | Unit-aware conversion (search `MG`/`UG`, full `mg`/`µg`); vitamin D IU ÷ 40 | `_100g` values are **grams** → ×1000 mg, vitamin D ×10⁶ µg |
| Sodium | 1093 | `sodium_100g`, else salt ÷ 2.5 |
| Carbohydrate | By difference (1005, includes fiber), fallback by summation | `carbohydrates-total` when present, else `carbohydrates` (EU: available carbs, excludes fiber) |
| Estimated zero | — | `~0` (estimated, not on the label) → unknown |
| Servings | Branded `servingSize` (g/ml) + household text; `foodPortions` (detail) / `foodMeasures` (search); "Quantity not specified" dropped | `serving_quantity` (g or ml) + `serving_size` label |
| Allergens | Unknown (`null`) | `allergens_tags` + `traces_tags` mapped to app allergens; absent → `null`; empty and never analysed → `null` |
| Diet flags | Unknown (`null`) | Labels win, then ingredient analysis; maybe/unknown → `null` |
| Rejected items | No name, unsupported data type, or none of calories/protein/carbs/fat | Invalid barcode, no name, or none of calories/protein/carbs/fat |

Liquids: both sources may report drinks per 100 ml; without density data we treat 100 ml ≈ 100 g.

**Ids.** Unsaved provider results get a transient deterministic UUID (`providerFoodId(source, externalId)`, UUIDv5
namespaced with `provider:`) so list keys and caches are stable. They are never referenced as `foodId`: meal entries
snapshot them with `foodId: null`. Favoriting or saving one persists a user-owned copy via `toSavedProviderFood`,
whose id is `userFoodId(userId, source, externalId)` — saving twice is an idempotent upsert. `externalId` is the
fdcId (USDA) or the OFF-normalized barcode.

## Error mapping

| Situation | Open Food Facts | USDA (Edge Function) |
|---|---|---|
| Client budget exhausted / cool-down after 429 | `rate_limited` + `retryAfterMs` | `rate_limited` + remaining wait |
| HTTP 429 | `rate_limited`, Retry-After or 60 s | `rate_limited`, Retry-After or 3600 s |
| HTTP 404 | barcode: not found · search: `http` | `food` with `not_found` code: `null` · otherwise `unavailable` |
| HTTP 401/403 | `http` | `unavailable` |
| HTTP 5xx | `unavailable` | `unavailable`; 504 → `timeout` |
| Other 4xx | `http` | `http` |
| Network failure | `network` | `network` (`FunctionsFetchError`); relay error → `unavailable` |
| Time budget exceeded / caller abort | `timeout` / `aborted` | `timeout` / `aborted` |
| Malformed JSON or contract mismatch | `invalid_response` | `invalid_response` |
| HTTP 200 with JSON `status: 0` | `invalid_code` or `not_found` (checks the JSON, not only the HTTP code) | — |

## Attribution

- **Open Food Facts (ODbL):** wherever OFF-derived data is shown, show "Open Food Facts (ODbL)" linking to
  https://world.openfoodfacts.org. Every OFF `FoodItem.attribution` is `Open Food Facts (ODbL) · <barcode>`.
  OFF data is provided "as is" by contributors. Saved OFF foods stay separate rows (`source = 'off'`) so a
  redistributed collection of them remains an identifiable derivative database (share-alike). Product images are
  not used (CC BY-SA).
- **USDA FoodData Central (CC0):** attribution is requested, not required. Items carry
  `USDA FoodData Central · <data type> #<fdcId>`; the About screen should cite "U.S. Department of Agriculture,
  Agricultural Research Service. FoodData Central, 2026. fdc.nal.usda.gov."
- The UI shows the source badge (`FoodItem.source`) and `attribution` on food details.

## Adding a provider

1. Add its id to `FoodProviderId` and its `FoodSource` (shared contracts, coordinate the change; add a migration if
   foods from it can be saved).
2. Write a pure mapper `provider format → ProviderFoodDraft` in `src/services/food/normalize/` (per-100 g, unknown =
   `null`, unit conversions, rejection rules) with fixture-based tests from real responses.
3. Implement `FoodProvider` in `src/services/food/providers/`: validate responses with Zod, honour the `AbortSignal`,
   map failures to `FoodProviderError` kinds, add a client rate limiter if the API has per-IP limits, and keep keys
   server-side (Edge Function) if the API needs a secret.
4. Wire it into `createFoodSearchService` (decide: search-as-you-type, explicit action, or barcode only) and into
   `createDefaultFoodSearchService`. Use `readThrough` caching for successful remote answers.
5. Document it here: evaluation row, limits, licensing and the attribution string.
