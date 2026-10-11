import type { MealType, PantryItem } from '@/types'
import { SCORE_WEIGHTS, USE_SOON_DAYS, VARIANT_JITTER } from './constants'
import { mealMinutes, usesSoon } from './feasibility'
import type { SizedItem } from './portions'
import type { KcalRange } from './ranges'
import { plateRole, type PlateRole } from './roles'
import type { PlanTotals } from './types'

const nutrient = (item: SizedItem, key: 'protein' | 'carbs' | 'fat' | 'fiber') => ((item.item.food.per100g[key] ?? 0) * item.grams) / 100

export function totalsOf(items: readonly SizedItem[]): PlanTotals {
  const sum = (pick: (item: SizedItem) => number) => Math.round(items.reduce((total, item) => total + pick(item), 0) * 10) / 10
  return {
    kcal: Math.round(items.reduce((total, item) => total + item.kcal, 0)),
    protein: sum((item) => nutrient(item, 'protein')),
    carbs: sum((item) => nutrient(item, 'carbs')),
    fat: sum((item) => nutrient(item, 'fat')),
    fiber: sum((item) => nutrient(item, 'fiber')),
  }
}

const isMain = (meal: MealType) => meal !== 'snack'

/** How complete the plate is: a protein, a starch and produce for main meals; one or two items for snacks. */
function balanceScore(roles: readonly PlateRole[], meal: MealType): number {
  if (!isMain(meal)) return roles.length <= 2 ? 1 : 0.6
  const has = (...wanted: PlateRole[]) => roles.some((role) => wanted.includes(role))
  const parts = [has('protein', 'dish'), has('carb', 'dish'), has('veg', 'fruit')]
  return parts.filter(Boolean).length / parts.length
}

/** Small deterministic number in [0, 1) from a text (variant jitter without randomness). */
export function hashUnit(text: string): number {
  let hash = 2166136261
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return ((hash >>> 0) % 10_000) / 10_000
}

export interface ScoreInput {
  meal: MealType
  items: readonly SizedItem[]
  totals: PlanTotals
  range: KcalRange
  today: string
  variant: number
  id: string
}

/** 0…1-ish: calorie fit, protein, plate balance, fiber, quick preparation, meal-time fit, using food that expires soon. */
export function scoreOption({ meal, items, totals, range, today, variant, id }: ScoreInput): number {
  const half = Math.max(1, (range.max - range.min) / 2)
  const fit = Math.max(0, 1 - Math.abs(totals.kcal - range.target) / half)
  const proteinShare = totals.kcal > 0 ? (totals.protein * 4) / totals.kcal : 0
  const protein = Math.min(1, proteinShare / (isMain(meal) ? 0.25 : 0.15))
  const balance = balanceScore(items.map((entry) => plateRole(entry.item.food)), meal)
  const fiber = Math.min(1, totals.fiber / (isMain(meal) ? 6 : 2))
  const pantry: PantryItem[] = items.map((entry) => entry.item)
  const prep = 1 - Math.min(1, mealMinutes(pantry) / 60) * 0.5
  const suited = pantry.filter((item) => item.food.mealTypes.length === 0 || item.food.mealTypes.includes(meal)).length
  const mealFit = suited / Math.max(1, pantry.length)
  const soon = pantry.some((item) => usesSoon(item, today, USE_SOON_DAYS)) ? 1 : 0
  const w = SCORE_WEIGHTS
  const base = w.fit * fit + w.protein * protein + w.balance * balance + w.fiber * fiber + w.prep * prep + w.mealFit * mealFit + w.useSoon * soon
  return variant === 0 ? base : base + VARIANT_JITTER * hashUnit(`${variant}:${id}`)
}
