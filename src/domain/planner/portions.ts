import type { FoodItem, PantryItem } from '@/types'
import { portionRange, roundWithin, type GramRange } from '../adaptive'
import { MIN_PORTION_GRAMS } from './constants'
import type { KcalRange } from './ranges'
import { ROLE_ENERGY_SHARE, plateRole } from './roles'

export interface SizedItem {
  item: PantryItem
  grams: number
  quantity: number
  servingLabel: string | null
  servingGrams: number | null
  kcal: number
}

const GRAM_STEP = 5
const BALANCE_ROUNDS = 6
const TUNE_STEPS = 60

const kcalPerGram = (food: FoodItem) => (food.per100g.calories ?? 0) / 100

/**
 * Grams this item may contribute: the food's realistic portion range, never more than is at home. When less is
 * left than a usual portion, the rest (at least 10 g) may still be used.
 */
export function availableRange(item: PantryItem, alreadyUsed = 0): GramRange | null {
  const base = portionRange(item.food)
  const left = item.grams === null ? Number.POSITIVE_INFINITY : item.grams - alreadyUsed
  if (left < MIN_PORTION_GRAMS) return null
  const max = Math.min(base.max, left)
  return { min: Math.min(base.min, max), max }
}

const clamp = (value: number, range: GramRange) => Math.min(range.max, Math.max(range.min, value))

/** Splits `target` kcal by role shares, then shifts the rest to items that are not at a limit. */
function balance(items: readonly PantryItem[], ranges: readonly GramRange[], target: number): number[] {
  const shares = items.map((item) => ROLE_ENERGY_SHARE[plateRole(item.food)])
  const totalShare = shares.reduce((sum, share) => sum + share, 0)
  const grams = items.map((item, i) => {
    const density = kcalPerGram(item.food)
    const range = ranges[i] as GramRange
    return density > 0 ? clamp(((shares[i] ?? 0) / totalShare) * target / density, range) : range.min
  })
  for (let round = 0; round < BALANCE_ROUNDS; round += 1) {
    const kcal = grams.reduce((sum, g, i) => sum + g * kcalPerGram((items[i] as PantryItem).food), 0)
    const missing = target - kcal
    if (Math.abs(missing) < 5) break
    const free = items
      .map((item, i) => ({ i, density: kcalPerGram(item.food), share: shares[i] ?? 0 }))
      .filter(({ i, density }) => {
        const range = ranges[i] as GramRange
        const g = grams[i] ?? 0
        return density > 0 && (missing > 0 ? g < range.max : g > range.min)
      })
    const freeShare = free.reduce((sum, entry) => sum + entry.share, 0)
    if (free.length === 0 || freeShare === 0) break
    for (const { i, density, share } of free) {
      grams[i] = clamp((grams[i] ?? 0) + ((share / freeShare) * missing) / density, ranges[i] as GramRange)
    }
  }
  return grams
}

function sized(item: PantryItem, grams: number, range: GramRange): SizedItem {
  let portion = roundWithin(item.food, grams, range, true)
  // Household units may round past what is at home; grams never do.
  if (portion.grams > range.max + 1e-9) portion = roundWithin(item.food, grams, range, false)
  // 5 g steps can still round past a small remainder (37 g left → 40 g): use exactly what is there.
  if (portion.grams > range.max + 1e-9) {
    const left = Math.floor(range.max)
    portion = { grams: left, quantity: left, servingLabel: null, servingGrams: null }
  }
  return { item, ...portion, kcal: portion.grams * kcalPerGram(item.food) }
}

const total = (items: readonly SizedItem[]) => items.reduce((sum, item) => sum + item.kcal, 0)

/**
 * Realistic portions of `items` whose energy lands in `kcal` (min…max, aiming at its target), or null when no
 * portions within each item's range (and what is at home) can get there. Household units are used when they
 * fit; otherwise grams in 5 g steps, fine-tuned on the gram-measured items.
 */
export function sizePortions(items: readonly PantryItem[], kcal: KcalRange, used: Readonly<Record<string, number>> = {}): SizedItem[] | null {
  const ranges: GramRange[] = []
  for (const item of items) {
    const range = availableRange(item, used[item.id] ?? 0)
    if (!range) return null
    ranges.push(range)
  }
  const grams = balance(items, ranges, kcal.target)
  const result = items.map((item, i) => sized(item, grams[i] ?? 0, ranges[i] as GramRange))
  for (let step = 0; step < TUNE_STEPS; step += 1) {
    const energy = total(result)
    if (energy >= kcal.min && energy <= kcal.max) return result
    const up = energy < kcal.min
    // Adjust the gram-measured item that moves energy most, within its range.
    const candidates = result
      .map((entry, i) => ({ entry, i, density: kcalPerGram(entry.item.food) }))
      .filter(({ entry, i, density }) => {
        const range = ranges[i] as GramRange
        if (entry.servingLabel !== null || density <= 0) return false
        return up ? entry.grams + GRAM_STEP <= range.max : entry.grams - GRAM_STEP >= Math.max(GRAM_STEP, range.min)
      })
      .sort((a, b) => b.density - a.density || a.i - b.i)
    const pick = candidates[0]
    if (!pick) {
      // Switch one household-unit item to grams so it can be fine-tuned; give up when none is left.
      const unit = result.findIndex((entry) => entry.servingLabel !== null && kcalPerGram(entry.item.food) > 0)
      const entry = result[unit]
      if (!entry) return null
      result[unit] = { ...entry, quantity: entry.grams, servingLabel: null, servingGrams: null }
      continue
    }
    const next = pick.entry.grams + (up ? GRAM_STEP : -GRAM_STEP)
    result[pick.i] = { ...pick.entry, grams: next, quantity: next, kcal: next * pick.density }
  }
  return null
}
