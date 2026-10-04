import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * The subset of the supabase-js query builder the repositories use. Tests pass a small in-memory
 * fake; production passes the real `SupabaseClient`.
 */
export interface QueryResult {
  data: unknown
  error: unknown
  /** HTTP status; 0 when the request never got a response (network failure, abort, timeout). */
  status: number
}

export interface FilterQuery extends PromiseLike<QueryResult> {
  eq(column: string, value: string): this
  gte(column: string, value: string): this
  lte(column: string, value: string): this
  order(column: string, options: { ascending: boolean }): this
  range(from: number, to: number): this
  limit(count: number): this
  abortSignal(signal: AbortSignal): this
}

export interface ReturningQuery {
  select(columns: string): FilterQuery
}

export interface TableQuery {
  select(columns: string): FilterQuery
  upsert(values: object, options: { onConflict: string }): ReturningQuery
  delete(): FilterQuery
}

export interface SupabaseDataClient {
  from(table: string): TableQuery
}

/**
 * Views a supabase-js client (or a test fake) as a `SupabaseDataClient`.
 * supabase-js builders implement every method above, but proving it structurally makes `tsc` exceed
 * its type-instantiation depth (generic PostgREST result types). The contract is verified at runtime
 * against the real client in `supabaseClient.test.ts` (real supabase-js, stubbed fetch).
 */
export function toDataClient(client: SupabaseClient | SupabaseDataClient): SupabaseDataClient {
  return client as unknown as SupabaseDataClient
}
