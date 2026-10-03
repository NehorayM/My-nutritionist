# Contract: `food-search` Edge Function (USDA FoodData Central proxy)

Keeps the USDA api.data.gov key server-side. Implemented in `supabase/functions/food-search/`, consumed by
`src/services/food/providers/usdaProvider.ts` through `supabase.functions.invoke('food-search', { body })`.

## Request
`POST /functions/v1/food-search` with the signed-in user's JWT (`Authorization: Bearer …`, added by supabase-js).
Anonymous callers are rejected (protects the shared API quota).

```jsonc
{ "action": "search", "query": "chicken breast", "page": 1, "pageSize": 20 }
// query: trimmed, 2–100 chars · page: 1–50 · pageSize: 1–50
{ "action": "food", "fdcId": 171477 }
// fdcId: positive integer
```

## Success (200, `Content-Type: application/json`)
- `search` → `{ "totalHits": number, "currentPage": number, "totalPages": number, "foods": FdcSearchFood[] }`
  where each food keeps only: `fdcId, description, dataType, brandOwner, brandName, gtinUpc, servingSize,
  servingSizeUnit, householdServingFullText, foodNutrients[{ nutrientId, nutrientNumber, nutrientName, unitName, value }]`.
  Data types searched: Foundation, SR Legacy, Survey (FNDDS), Branded.
- `food` → the FDC `/v1/food/{fdcId}?format=abridged` JSON (unchanged).

## Errors
`{ "error": { "code": string, "message": string } }`

| Status | code | When |
|---|---|---|
| 400 | `invalid_request` | body fails validation |
| 401 | `unauthorized` | missing/invalid user JWT |
| 405 | `method_not_allowed` | not POST/OPTIONS |
| 429 | `rate_limited` | upstream 429; `Retry-After` header (seconds) forwarded when present |
| 502 | `upstream_error` | upstream non-2xx / malformed JSON |
| 503 | `not_configured` | `FDC_API_KEY` secret not set |
| 504 | `timeout` | upstream slower than 8 s |

CORS: `OPTIONS` preflight answered with the standard Supabase CORS headers.
The client maps 429 → `FoodProviderError('rate_limited')`, 503 → `'unavailable'`, 504 → `'timeout'`,
network failures → `'network'`, schema mismatch → `'invalid_response'`.
