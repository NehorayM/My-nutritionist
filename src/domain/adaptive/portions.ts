import type { FoodItem } from '@/types'
import { gramsForQuantity, isKnownAmount, scaleNutrients } from '../nutrition'
import { PORTION_TOLERANCE } from './constants'
import { portionRange, sideShare, type GramRange } from './portionRanges'
import type { RecommendedItem } from './types'

const GRAM_STEP = 5
const MAX_SERVING_UNITS = 4

function clamp(value: number, range: GramRange): number {
  return Math.min(range.max, Math.max(range.min, value))
}

type Portion = Pick<RecommendedItem, 'grams' | 'quantity' | 'servingLabel' | 'servingGrams'>

/** Whole household units (1–4) within ±15 % of the wanted grams, closest first; null when none fits. */
function servingPortion(food: FoodItem, grams: number): Portion | null {
  let best: Portion | null = null
  let bestDiff = Number.POSITIVE_INFINITY
  for (const serving of food.servings) {
    if (!Number.isFinite(serving.grams) || serving.grams <= 0) continue
    const units = Math.round(grams / serving.grams)
    if (units < 1 || units > MAX_SERVING_UNITS) continue
    const total = gramsForQuantity(units, serving.grams)
    const diff = Math.abs(total - grams)
    if (diff > PORTION_TOLERANCE * grams || diff >= bestDiff) continue
    best = { grams: total, quantity: units, servingLabel: serving.label, servingGrams: serving.grams }
    bestDiff = diff
  }
  return best
}

/** `roundPortion` with the food's range already known. */
function roundWithin(food: FoodItem, grams: number, range: GramRange, householdUnits: boolean): Portion {
  const wanted = clamp(grams, range)
  const serving = householdUnits ? servingPortion(food, wanted) : null
  if (serving) return serving
  const low = Math.max(GRAM_STEP, Math.ceil(range.min / GRAM_STEP) * GRAM_STEP)
  const high = Math.max(low, Math.floor(range.max / GRAM_STEP) * GRAM_STEP)
  const stepped = Math.min(high, Math.max(low, Math.round(wanted / GRAM_STEP) * GRAM_STEP))
  return { grams: stepped, quantity: stepped, servingLabel: null, servingGrams: null }
}

/**
 * A realistic portion near `grams`: clamped to the food's range, then whole household units when one fits
 * within ±15 % (unless `householdUnits` is false), otherwise grams rounded to 5 g (never below 5 g).
 */
export function roundPortion(food: FoodItem, grams: number, householdUnits = true): Portion {
  return roundWithin(food, grams, portionRange(food), householdUnits)
}

function kcalPerGram(food: FoodItem): number {
  return (food.per100g.calories ?? 0) / 100
}

/** Grams supplying `kcal` within `range` (the smallest realistic portion for a food without energy). */
function gramsForKcal(food: FoodItem, kcal: number, range: GramRange): number {
  const density = kcalPerGram(food)
  return clamp(density > 0 ? Math.max(0, kcal) / density : range.min, range)
}

/** Typical grams of a food served as a side of a `mealKcal` meal: its category's energy share, within its range. */
export function sideGrams(food: FoodItem, mealKcal: number): number {
  return gramsForKcal(food, sideShare(food) * mealKcal, portionRange(food))
}

interface Component {
  food: FoodItem
  range: GramRange
  grams: number
}

function energyOf(components: readonly Component[]): number {
  return components.reduce((sum, part) => sum + part.grams * kcalPerGram(part.food), 0)
}

function rescaleSides(sides: readonly Component[], energyLeft: number): Component[] {
  const sideKcal = energyOf(sides)
  if (sideKcal <= 0) return [...sides]
  const factor = Math.max(0, energyLeft) / sideKcal
  return sides.map((part) => ({ ...part, grams: clamp(part.grams * factor, part.range) }))
}

interface Rounded {
  food: FoodItem
  portion: Portion
}

function roundAll(components: readonly Component[], householdUnits: boolean): Rounded[] {
  return components.map(({ food, range, grams }) => ({ food, portion: roundWithin(food, grams, range, householdUnits) }))
}

/** Distance of the rounded option's energy from the target (energy computed as `scaleNutrients` does). */
function miss(rounded: readonly Rounded[], targetKcal: number): number {
  const kcal = rounded.reduce((sum, { food, portion }) => {
    const per100g = food.per100g.calories
    return sum + (isKnownAmount(per100g) ? (per100g * portion.grams) / 100 : 0)
  }, 0)
  return Math.abs(kcal - targetKcal)
}

function toItems(rounded: readonly Rounded[]): RecommendedItem[] {
  return rounded.map(({ food, portion }) => ({ food, ...portion, nutrients: scaleNutrients(food.per100g, portion.grams) }))
}

/**
 * Portions for an option (first food = anchor) aiming at `targetKcal`: sides take their category's share of the
 * energy, the anchor takes the rest; when the anchor hits its range limit the sides are rescaled to land within
 * ±15 % of the target where the ranges allow. Household units are used unless rounding to them moves the option
 * outside ±15 % of the target; then 5 g steps are used when they land closer.
 */
export function portionOption(foods: readonly FoodItem[], targetKcal: number): RecommendedItem[] {
  const [anchorFood, ...sideFoods] = foods
  if (!anchorFood) return []
  let sides = sideFoods.map((food): Component => {
    const range = portionRange(food)
    return { food, range, grams: gramsForKcal(food, sideShare(food) * targetKcal, range) }
  })
  const sideKcal = energyOf(sides)
  const anchorRange = portionRange(anchorFood)
  const anchor: Component = { food: anchorFood, range: anchorRange, grams: gramsForKcal(anchorFood, targetKcal - sideKcal, anchorRange) }
  const anchorKcal = energyOf([anchor])
  if (Math.abs(anchorKcal + sideKcal - targetKcal) > PORTION_TOLERANCE * targetKcal) {
    sides = rescaleSides(sides, targetKcal - anchorKcal)
  }
  const components = [anchor, ...sides]
  const household = roundAll(components, true)
  const householdMiss = miss(household, targetKcal)
  if (householdMiss <= PORTION_TOLERANCE * targetKcal) return toItems(household)
  const stepped = roundAll(components, false)
  return toItems(miss(stepped, targetKcal) < householdMiss ? stepped : household)
}
