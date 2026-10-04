import { createClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { makeMeal, makeWeight, testId, USER_A } from '@/schemas/__fixtures__/records'
import { createSupabaseRepositories } from './index'
import { mealEntryToRow, weightEntryToRow } from './mappers'

/**
 * Contract test against the REAL supabase-js client with a stubbed `fetch`: proves the client
 * satisfies `SupabaseDataClient` at runtime and pins the HTTP requests PostgREST receives.
 */
const URL_BASE = 'http://127.0.0.1:54321'

type Responder = (url: URL, init: RequestInit) => Promise<Response> | Response

function setup(respond: Responder, timeoutMs?: number) {
  const requests: { url: URL; method: string; headers: Headers; body: unknown }[] = []
  const fetchStub = vi.fn<typeof fetch>(async (input, init = {}) => {
    const url = new URL(input instanceof Request ? input.url : String(input))
    const body = typeof init.body === 'string' && init.body !== '' ? (JSON.parse(init.body) as unknown) : null
    requests.push({ url, method: init.method ?? 'GET', headers: new Headers(init.headers), body })
    return respond(url, init)
  })
  const client = createClient(URL_BASE, 'sb_publishable_test_key', {
    global: { fetch: fetchStub },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  return { repos: createSupabaseRepositories(client, USER_A, timeoutMs ? { timeoutMs } : {}), requests }
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })

describe('real supabase-js client', () => {
  it('selects with owner filter, inclusive date range, order and paging', async () => {
    const row = { ...mealEntryToRow(makeMeal()), quantity: '1.500', grams: '273.000', serving_grams: '182.000' }
    const { repos, requests } = setup(() => json([row]))
    expect(await repos.meals.listRange({ from: '2026-10-01', to: '2026-10-07' })).toEqual([makeMeal()])
    const [request] = requests
    expect(request?.method).toBe('GET')
    expect(request?.url.pathname).toBe('/rest/v1/meal_logs')
    const params = request?.url.searchParams
    expect(params?.get('select')).toBe('*')
    expect(params?.get('user_id')).toBe(`eq.${USER_A}`)
    expect(params?.getAll('log_date')).toEqual(['gte.2026-10-01', 'lte.2026-10-07'])
    expect(params?.get('order')).toBe('log_date.asc,logged_at.asc,id.asc')
    expect([params?.get('offset'), params?.get('limit')]).toEqual(['0', '1000'])
  })

  it('upserts with on_conflict=id and asks for the stored row back', async () => {
    const row = weightEntryToRow(makeWeight())
    const { repos, requests } = setup(() => json([{ ...row, weight_kg: '72.35', updated_at: '2026-10-03T08:15:00.000000+00:00' }], 201))
    expect(await repos.weights.save(makeWeight())).toEqual(makeWeight())
    const [request] = requests
    expect(request?.method).toBe('POST')
    expect(request?.url.searchParams.get('on_conflict')).toBe('id')
    expect(request?.url.searchParams.get('select')).toBe('*')
    expect(request?.headers.get('Prefer')).toContain('resolution=merge-duplicates')
    expect(request?.headers.get('Prefer')).toContain('return=representation')
    expect(request?.body).toEqual(row)
  })

  it('falls back to reading the row when the upsert returns none (stale write skipped)', async () => {
    const newer = makeWeight({ weightKg: 71, updatedAt: '2026-10-04T08:00:00.000Z' })
    const { repos, requests } = setup((_url, init) => (init.method === 'POST' ? json([], 201) : json([weightEntryToRow(newer)])))
    expect(await repos.weights.save(makeWeight())).toEqual(newer)
    expect(requests.map((r) => r.method)).toEqual(['POST', 'GET'])
    expect(requests[1]?.url.searchParams.get('id')).toBe(`eq.${newer.id}`)
    expect(requests[1]?.url.searchParams.get('user_id')).toBe(`eq.${USER_A}`)
  })

  it('deletes by id and owner', async () => {
    const { repos, requests } = setup(() => new Response(null, { status: 204 }))
    await repos.meals.remove(testId(7))
    expect(requests[0]?.method).toBe('DELETE')
    expect(requests[0]?.url.searchParams.get('id')).toBe(`eq.${testId(7)}`)
    expect(requests[0]?.url.searchParams.get('user_id')).toBe(`eq.${USER_A}`)
  })

  it('classifies HTTP and network failures', async () => {
    const rls = setup(() => json({ code: '42501', message: 'new row violates row-level security policy', details: null, hint: null }, 403))
    await expect(rls.repos.meals.save(makeMeal())).rejects.toMatchObject({ kind: 'permission', retryable: false, status: 403 })

    const down = setup(() => {
      throw new TypeError('Failed to fetch')
    })
    await expect(down.repos.meals.save(makeMeal())).rejects.toMatchObject({ kind: 'network', retryable: true, status: 0 })

    const server = setup(() => json({ message: 'boom' }, 500))
    await expect(server.repos.meals.remove(testId(1))).rejects.toMatchObject({ kind: 'server', retryable: true })
  })

  it('aborts slow requests and reports a retryable timeout', async () => {
    const slow = setup(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(init.signal?.reason))
        }),
      20,
    )
    await expect(slow.repos.meals.save(makeMeal())).rejects.toMatchObject({ kind: 'timeout', retryable: true })
  })
})
