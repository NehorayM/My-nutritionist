# Contract: `food-search` Edge Function (USDA FoodData Central proxy)

Keeps the USDA api.data.gov key server-side (keys found in public code are deactivated, and the hourly quota is
shared by all users). Implemented in `supabase/functions/food-search/index.ts`, consumed by
`src/services/food/providers/usdaProvider.ts` through `supabase.functions.invoke('food-search', { body })`.

USDA → normalized mapping lives in ONE plain-TypeScript module with no Deno or browser globals:
`supabase/functions/_shared/usda/normalize.ts`. The Edge Function imports it (relative `.ts` import) and Vitest tests
import it directly, so the mapping is unit-tested once and the client never parses FDC formats.

## Request
`POST /functions/v1/food-search` with the signed-in user's JWT (`Authorization: Bearer …`, added by supabase-js) and
the publishable key in `apikey`. Anonymous callers are rejected (protects the shared quota).

```jsonc
{ "action": "search", "query": "chicken breast", "page": 1, "pageSize": 20, "scope": "generic" }
// query: trimmed, 2–100 chars · page: 1–50 · pageSize: 1–50
// scope: "generic" (default) → dataType ["Foundation","SR Legacy","Survey (FNDDS)"]; "branded" → ["Branded"]
{ "action": "food", "fdcId": 171477 }
// fdcId: positive integer → upstream GET /v1/food/{fdcId}?format=full&nutrients=<the ≤25 nutrient numbers we map>
```

## Success (200, `Content-Type: application/json`)
```ts
interface UsdaFoodDto {
  externalId: string            // fdcId as string
  name: string                  // description (title-cased sensibly, max 200 chars)
  brand: string | null          // brandName ?? brandOwner (Branded only)
  barcode: string | null        // gtinUpc when 6–14 digits
  dataType: 'foundation' | 'sr_legacy' | 'survey_fndds' | 'branded'
  per100g: Record<NutrientKey, number | null>   // unknown = null, never 0 unless USDA reports 0
  servings: { label: string; grams: number }[]  // Branded servingSize(g) / householdServingFullText; foodPortions/foodMeasures
  attribution: string           // e.g. "USDA FoodData Central · SR Legacy #171477"
}
// search → { page: number, pageSize: number, totalHits: number, totalPages: number, foods: UsdaFoodDto[] }
// food   → { food: UsdaFoodDto }
```
Items without a name or without any of calories/protein/carbs/fat are dropped server-side.

## Errors
`{ "error": { "code": string, "message": string } }`

| Status | code | When |
|---|---|---|
| 400 | `invalid_request` | body fails validation |
| 401 | `unauthorized` | missing/invalid user JWT |
| 404 | `not_found` | `food` action with unknown fdcId |
| 405 | `method_not_allowed` | not POST/OPTIONS |
| 429 | `rate_limited` | upstream 429; `Retry-After` forwarded, or `3600` when upstream omits it |
| 502 | `upstream_error` | upstream non-2xx / malformed JSON |
| 503 | `not_configured` | `FDC_API_KEY` secret not set |
| 504 | `timeout` | upstream slower than 8 s |

CORS: `OPTIONS` preflight answered with the standard Supabase CORS headers. A small in-memory LRU (per isolate,
TTL 24 h for searches / 30 d for foods) reduces upstream calls; correctness never depends on it.
The client maps 429 → `FoodProviderError('rate_limited')`, 503/404-on-search → `'unavailable'`, 504 → `'timeout'`,
network failures → `'network'`, schema mismatch → `'invalid_response'`.
