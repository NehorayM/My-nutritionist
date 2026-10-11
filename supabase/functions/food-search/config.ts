/**
 * Environment of the `food-search` Edge Function (see _shared/env.ts for how Supabase provides its keys).
 * FDC_API_KEY is our own secret: `supabase secrets set FDC_API_KEY=…` (hosted) or supabase/functions/.env (local).
 */
import { nonEmpty, pickPublishableKey, type EnvGetter } from '../_shared/env.ts'

export { pickPublishableKey, type EnvGetter }

export interface FunctionEnv {
  supabaseUrl: string | null
  publishableKey: string | null
}

export function readFunctionEnv(get: EnvGetter): FunctionEnv {
  return { supabaseUrl: nonEmpty(get('SUPABASE_URL')), publishableKey: pickPublishableKey(get) }
}

/** The api.data.gov key for FoodData Central, or null when the secret is not configured. */
export function readFdcApiKey(get: EnvGetter): string | null {
  return nonEmpty(get('FDC_API_KEY'))
}
