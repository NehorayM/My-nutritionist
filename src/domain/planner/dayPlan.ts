import type { MealType, PantryItem } from '@/types'
import { REPEAT_PENALTY } from './constants'
import type { KcalRange } from './ranges'
import type { DayPlan, MealOption, PlanTotals } from './types'

const EMPTY: PlanTotals = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }

function addTotals(a: PlanTotals, b: PlanTotals): PlanTotals {
  const r = (n: number) => Math.round(n * 10) / 10
  return { kcal: a.kcal + b.kcal, protein: r(a.protein + b.protein), carbs: r(a.carbs + b.carbs), fat: r(a.fat + b.fat), fiber: r(a.fiber + b.fiber) }
}

/**
 * The best combination of one option per meal: total pantry use never exceeds what is at home, and the day's
 * energy lands in the daily range when possible (`fits`); otherwise the combination closest to the range.
 * Objective: sum of option scores minus a penalty for the same item in several meals.
 */
export function composeDay(
  meals: readonly { mealType: MealType; options: readonly MealOption[] }[],
  pantry: readonly PantryItem[],
  day: KcalRange,
): DayPlan | null {
  const planned = meals.filter((meal) => meal.options.length > 0)
  if (planned.length === 0) return null
  const stock = new Map(pantry.map((item) => [item.id, item.grams]))
  let best: { picks: MealOption[]; value: number; distance: number } | null = null

  const search = (index: number, picks: MealOption[], usage: Map<string, number>, value: number, kcal: number) => {
    if (index === planned.length) {
      const distance = kcal < day.min ? day.min - kcal : kcal > day.max ? kcal - day.max : 0
      if (!best || distance < best.distance || (distance === best.distance && value > best.value)) {
        best = { picks: [...picks], value, distance }
      }
      return
    }
    for (const option of planned[index]?.options ?? []) {
      let repeats = 0
      let fits = true
      const next = new Map(usage)
      for (const item of option.items) {
        const used = (next.get(item.pantryItemId) ?? 0) + item.grams
        const available = stock.get(item.pantryItemId)
        if (available !== null && available !== undefined && used > available + 1e-6) fits = false
        if (next.has(item.pantryItemId)) repeats += 1
        next.set(item.pantryItemId, used)
      }
      if (!fits) continue
      picks.push(option)
      search(index + 1, picks, next, value + option.score - REPEAT_PENALTY * repeats, kcal + option.totals.kcal)
      picks.pop()
    }
  }
  search(0, [], new Map(), 0, 0)

  const chosen = best as { picks: MealOption[]; distance: number } | null
  if (!chosen) return null
  const mealsPlan: Partial<Record<MealType, MealOption>> = {}
  const usage: Record<string, number> = {}
  let totals = EMPTY
  for (const option of chosen.picks) {
    mealsPlan[option.mealType] = option
    totals = addTotals(totals, option.totals)
    for (const item of option.items) usage[item.pantryItemId] = (usage[item.pantryItemId] ?? 0) + item.grams
  }
  return { meals: mealsPlan, totals, usage, fits: chosen.distance === 0 && planned.length === meals.length }
}
