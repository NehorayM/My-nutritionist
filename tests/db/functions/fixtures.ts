import { vi } from 'vitest'

/** Minimal FDC payloads in the shapes the API really returns (search rows vs format=full rows). */
export const SEARCH_BODY = {
  totalHits: 2,
  currentPage: 1,
  totalPages: 1,
  foods: [
    {
      fdcId: 171477,
      dataType: 'SR Legacy',
      description: 'Chicken, broilers or fryers, breast, meat only, cooked, roasted',
      foodNutrients: [
        { nutrientId: 1008, nutrientNumber: '208', unitName: 'KCAL', value: 165 },
        { nutrientId: 1003, nutrientNumber: '203', unitName: 'G', value: 31.02 },
        { nutrientId: 1004, nutrientNumber: '204', unitName: 'G', value: 3.57 },
        { nutrientId: 1093, nutrientNumber: '307', unitName: 'MG', value: 74 },
      ],
      foodMeasures: [],
    },
    { fdcId: 999, dataType: 'SR Legacy', description: 'No nutrients at all', foodNutrients: [] },
  ],
}

export const FOOD_BODY = {
  fdcId: 171688,
  dataType: 'SR Legacy',
  description: 'Apples, raw, with skin',
  foodNutrients: [
    { type: 'FoodNutrient', amount: 52, nutrient: { id: 1008, number: '208', name: 'Energy', unitName: 'kcal' } },
    { type: 'FoodNutrient', amount: 0.26, nutrient: { id: 1003, number: '203', name: 'Protein', unitName: 'g' } },
    { type: 'FoodNutrient', nutrient: { id: 2045, name: 'Proximates' } },
  ],
  foodPortions: [{ amount: 1, modifier: 'medium (3" dia)', gramWeight: 182, sequenceNumber: 1 }],
}

export function jsonReply(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })
}

/** A fetch double that records calls and answers from a queue. */
export function fakeFetch(...replies: Array<Response | Error>) {
  const queue = [...replies]
  return vi.fn<typeof fetch>(async () => {
    const next = queue.shift()
    if (next === undefined) throw new Error('Unexpected upstream call')
    if (next instanceof Error) throw next
    return next
  })
}

/** A fetch double that never answers but rejects with the abort reason (e.g. the 8 s timeout). */
export function hangingFetch() {
  return vi.fn<typeof fetch>(
    (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason))
      }),
  )
}

export function lastCall(fetchMock: ReturnType<typeof fakeFetch>): { url: string; init: RequestInit } {
  const call = fetchMock.mock.calls.at(-1)
  if (!call) throw new Error('fetch was not called')
  return { url: String(call[0]), init: call[1] ?? {} }
}
