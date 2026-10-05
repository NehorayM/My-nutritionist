import { describe, expect, it } from 'vitest'
import { SYSTEM_FOODS } from '@/data/systemFoods'
import { MEAL_TYPES } from '@/types'
import { entry, food, localTime, planInput, profile, recommendedFoods, systemFood, targetsFor } from './__fixtures__/adaptive'
import { buildAdaptivePlan } from './engine'
import { optionTotals } from './ranking'

describe('buildAdaptivePlan — statuses', () => {
  it('offers nothing for a past day', () => {
    const plan = buildAdaptivePlan(planInput({ date: '2026-10-03' }))
    expect(plan).toEqual({ status: 'past_day', targetMeal: null, budget: {}, recommendations: [], message: expect.any(String) })
  })

  it('reports a complete day when no meal slot remains', () => {
    const plan = buildAdaptivePlan(planInput({ now: localTime(23, 30) }))
    expect(plan.status).toBe('day_complete')
    expect(plan.targetMeal).toBeNull()
    expect(plan.recommendations).toEqual([])
  })

  it('plans breakfast for a future day', () => {
    const plan = buildAdaptivePlan(planInput({ date: '2026-10-05', now: localTime(21, 0) }))
    expect(plan.status).toBe('ok')
    expect(plan.targetMeal).toBe('breakfast')
  })

  it('suggests adding foods when there are none to choose from', () => {
    const plan = buildAdaptivePlan(planInput({ foods: [] }))
    expect(plan.status).toBe('no_candidates')
    expect(plan.targetMeal).toBe('lunch')
    expect(plan.budget.calories).toBeGreaterThan(0)
    expect(plan.message).toContain('adding foods')
  })

  it('suggests reviewing preferences when every food is filtered out', () => {
    const unknownAllergens = SYSTEM_FOODS.map((item) => ({ ...item, allergens: null }))
    const plan = buildAdaptivePlan(planInput({ foods: unknownAllergens, profile: profile({ allergies: ['peanuts'] }) }))
    expect(plan.status).toBe('no_candidates')
    expect(plan.recommendations).toEqual([])
    expect(plan.message).toContain('reviewing allergies, dislikes, diet or prep time')
  })

  it('rejects an invalid date key', () => {
    expect(() => buildAdaptivePlan(planInput({ date: '2026-13-01' }))).toThrow(RangeError)
  })
})

describe('buildAdaptivePlan — a regular day', () => {
  const input = planInput()
  const plan = buildAdaptivePlan(input)

  it('suggests 3–6 options for the next meal, sorted by score', () => {
    expect(plan.status).toBe('ok')
    expect(plan.targetMeal).toBe('lunch')
    expect(plan.recommendations.length).toBeGreaterThanOrEqual(3)
    expect(plan.recommendations.length).toBeLessThanOrEqual(6)
    const scores = plan.recommendations.map((rec) => rec.score)
    expect(scores).toEqual([...scores].sort((a, b) => b - a))
    expect(plan.message).toBe('Options for lunch that add protein and fiber to your day.')
  })

  it('aims at the meal’s share of the day', () => {
    const daily = targetsFor(profile()).targets.calories!.amount
    expect(plan.budget.calories).toBeCloseTo(daily / 2.35)
  })

  it('presents complete, consistent recommendations', () => {
    for (const rec of plan.recommendations) {
      expect(rec.id).toBe(`${rec.style}:lunch:${rec.items.map((item) => item.food.id).sort().join('+')}`)
      expect(rec.mealType).toBe('lunch')
      expect(rec.totals).toEqual(optionTotals(rec.items))
      expect(rec.title.length).toBeGreaterThan(0)
      expect(rec.explanation).toMatch(/^[A-Z].*\.$/)
      expect(rec.highlights.length).toBeLessThanOrEqual(3)
      expect(rec.prepMinutes).toBeLessThanOrEqual(45)
      expect(rec.score).toBeCloseTo(Object.values(rec.breakdown).reduce((sum, value) => sum + value, 0))
      expect(Math.abs((rec.totals.calories ?? 0) - plan.budget.calories!)).toBeLessThanOrEqual(0.3 * plan.budget.calories!)
    }
  })

  it('offers different item sets and styles', () => {
    const keys = plan.recommendations.map((rec) => rec.items.map((item) => item.food.id).sort().join('+'))
    expect(new Set(keys).size).toBe(keys.length)
    expect(new Set(plan.recommendations.map((rec) => rec.style)).size).toBe(plan.recommendations.length)
  })

  it('is deterministic: the same input gives the same plan and ids', () => {
    expect(buildAdaptivePlan(planInput())).toEqual(plan)
  })

  it('only suggests foods suited to the meal slot', () => {
    for (const item of recommendedFoods(plan)) expect(item.mealTypes.length === 0 || item.mealTypes.includes('lunch')).toBe(true)
  })

  it('works before onboarding (no profile)', () => {
    const general = buildAdaptivePlan(planInput({ profile: null }))
    expect(general.status).toBe('ok')
    expect(general.recommendations.length).toBeGreaterThanOrEqual(3)
  })
})

describe('buildAdaptivePlan — dismissing and alternatives', () => {
  it('never returns dismissed options and replaces them', () => {
    const first = buildAdaptivePlan(planInput())
    const dismissed = first.recommendations.slice(0, 2).map((rec) => rec.id)
    const next = buildAdaptivePlan(planInput({ dismissedIds: dismissed }))
    expect(next.recommendations.map((rec) => rec.id)).not.toContain(dismissed[0])
    expect(next.recommendations.map((rec) => rec.id)).not.toContain(dismissed[1])
    expect(next.recommendations.length).toBeGreaterThanOrEqual(3)
  })

  it('says so when every option has been set aside', () => {
    const dismissedIds: string[] = []
    let plan = buildAdaptivePlan(planInput())
    for (let round = 0; round < 15 && plan.recommendations.length > 0; round += 1) {
      dismissedIds.push(...plan.recommendations.map((rec) => rec.id))
      plan = buildAdaptivePlan(planInput({ dismissedIds }))
    }
    expect(plan.recommendations).toEqual([])
    expect(plan.status).toBe('ok')
    expect(plan.message).toContain('set aside')
  })

  it('rotates alternatives deterministically with the variant', () => {
    const ids = (variant?: number) => buildAdaptivePlan(planInput({ variant })).recommendations.map((rec) => rec.id)
    expect(ids(1)).toEqual(ids(1))
    expect(ids(1)).not.toEqual(ids(0))
    expect(ids(undefined)).toEqual(ids(0))
  })
})

describe('buildAdaptivePlan — under-18s', () => {
  it('keeps regular-sized meals even after a large day', () => {
    const teen = profile({ birthDate: '2011-03-01' })
    const pizza = systemFood('cheese_pizza')
    const entries = [entry(pizza, 900, 'breakfast'), entry(pizza, 700, 'lunch')]
    const plan = buildAdaptivePlan(planInput({ profile: teen, entries, now: localTime(18, 0) }))
    const daily = targetsFor(teen).targets.calories!.amount
    expect(plan.status).toBe('ok')
    expect(plan.budget.calories).toBeCloseTo(daily / 3.35)
    expect(plan.message).not.toContain('above your energy target')
  })
})

interface CpuUsage {
  user: number
  system: number
}

type CpuClock = (previous?: CpuUsage) => CpuUsage

/**
 * Milliseconds of CPU time `run` takes on this thread, so neither waiting for a busy machine nor V8's background
 * compiler and GC threads (counted by the process-wide clock) are counted. Falls back to the process clock, then
 * to wall-clock time, when the runtime lacks the finer clock.
 */
function cpuMilliseconds(run: () => void): number {
  const node = (globalThis as { process?: { threadCpuUsage?: CpuClock; cpuUsage?: CpuClock } }).process
  const clock = node?.threadCpuUsage?.bind(node) ?? node?.cpuUsage?.bind(node)
  if (!clock) {
    const start = performance.now()
    run()
    return performance.now() - start
  }
  const start = clock()
  run()
  const used = clock(start)
  return (used.user + used.system) / 1000
}

describe('buildAdaptivePlan — performance', () => {
  it('plans from 150 foods in under 30 ms for every meal slot (best of twenty interleaved runs, after warming up)', () => {
    const variants = Array.from({ length: 150 - SYSTEM_FOODS.length }, (_, i) => {
      const base = SYSTEM_FOODS[i % SYSTEM_FOODS.length]!
      return food({ ...base, id: `variant-${i}`, name: `${base.name} (homemade ${i})`, per100g: { ...base.per100g } })
    })
    const foods = [...SYSTEM_FOODS, ...variants]
    const inputs = MEAL_TYPES.map((_, i) => planInput({ foods, now: localTime([8, 12, 18, 22][i]!, 30) }))
    const plans = inputs.map((input) => buildAdaptivePlan(input))
    expect(plans.map((plan) => plan.targetMeal)).toEqual(['breakfast', 'lunch', 'dinner', 'snack'])
    for (const plan of plans) expect(plan.recommendations.length).toBeGreaterThanOrEqual(3)
    for (let round = 0; round < 3; round += 1) for (const input of inputs) buildAdaptivePlan(input)
    // Rounds visit every slot in turn, so a busy moment on the machine slows one sample of each slot, not all of one.
    const best = inputs.map(() => Number.POSITIVE_INFINITY)
    for (let round = 0; round < 20; round += 1) {
      inputs.forEach((input, i) => {
        best[i] = Math.min(best[i]!, cpuMilliseconds(() => buildAdaptivePlan(input)))
      })
    }
    expect(foods).toHaveLength(150)
    expect(Math.max(...best)).toBeLessThan(30)
  })
})
