/**
 * Response helpers for the `food-search` Edge Function (docs/contracts/food-search-function.md).
 * Every response — including errors — carries the CORS headers so browsers can read the status and body.
 */
import { corsHeaders } from '@supabase/supabase-js/cors'
import type { UsdaErrorCode } from '../_shared/usda/types.ts'

/** Supabase SDK CORS headers + `Retry-After` exposed so the browser client can honour 429 back-off. */
export const CORS_HEADERS: Readonly<Record<string, string>> = {
  ...corsHeaders,
  'Access-Control-Expose-Headers': 'Retry-After',
}

export function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json; charset=utf-8', ...headers },
  })
}

export function errorResponse(
  status: number,
  code: UsdaErrorCode,
  message: string,
  headers: Record<string, string> = {},
): Response {
  return jsonResponse(status, { error: { code, message } }, headers)
}

export function preflightResponse(): Response {
  return new Response('ok', { status: 200, headers: { ...CORS_HEADERS } })
}
