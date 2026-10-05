/**
 * Edge Function `food-search` — USDA FoodData Central proxy (docs/contracts/food-search-function.md).
 *
 * Local:   npx supabase functions serve food-search   (reads supabase/functions/.env → FDC_API_KEY)
 * Hosted:  npx supabase secrets set FDC_API_KEY=<api.data.gov key> && npx supabase functions deploy food-search
 *
 * This file only wires Deno globals into the runtime-agnostic handler (handler.ts).
 */
import { createSupabaseClaimsVerifier, createUserVerifier } from './auth.ts'
import { readFdcApiKey, readFunctionEnv, type EnvGetter } from './config.ts'
import { createFoodSearchHandler, type LogFn } from './handler.ts'

const getEnv: EnvGetter = (name) => Deno.env.get(name)

const log: LogFn = (message, details) => {
  console.error(JSON.stringify({ function: 'food-search', message, ...details }))
}

const env = readFunctionEnv(getEnv)
const verifyUser =
  env.supabaseUrl !== null && env.publishableKey !== null
    ? createUserVerifier(createSupabaseClaimsVerifier(env.supabaseUrl, env.publishableKey), (error) =>
        log('auth_verification_error', { error: error instanceof Error ? error.name : 'unknown' }),
      )
    : null

Deno.serve(
  createFoodSearchHandler({
    verifyUser,
    getApiKey: () => readFdcApiKey(getEnv),
    fetch: (input, init) => fetch(input, init),
    now: () => Date.now(),
    log,
  }),
)
