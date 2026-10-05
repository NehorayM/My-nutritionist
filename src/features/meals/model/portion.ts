import { gramsForQuantity } from '@/domain/nutrition'
import { formatGrams, formatNumber } from '@/lib/format'
import { isUuid } from '@/lib/id'
import { isUnsavedProviderFood } from '@/services/food'
import { portionAmountError } from '@/stores/mealsStore'
import type { FoodItem, FoodPortion, ServingOption } from '@/types'

/** Unit value for grams in unit selectors; servings use `s:<label>`. */
export const GRAMS_UNIT = 'g'
/** Default amount when a food has no household servings. */
export const DEFAULT_GRAMS = 100

export interface UnitOption {
  value: string
  label: string
  /** Grams per unit; null = the unit is grams. */
  grams: number | null
}

export interface PortionValues {
  unit: string
  quantity: number | null
}

const servingValue = (label: string) => `s:${label}`
const GRAMS_SUFFIX = /\s*\(\s*[\d.,]+\s*g\s*\)\s*$/i

/** "1 cup (158 g)" → "1 cup": the grams are shown separately for the chosen amount. */
export function servingUnitName(label: string): string {
  return label.replace(GRAMS_SUFFIX, '').trim() || label
}

/** Text of a unit in a picker: "grams", "1 cup (158 g)", and "1 bar (40 g)" for labels without their weight. */
export function unitOptionText(option: UnitOption): string {
  if (option.grams === null) return option.label
  return GRAMS_SUFFIX.test(option.label) ? option.label : `${option.label} (${formatPortionGrams(option.grams)})`
}

/** 1 → "1", 1.5 → "1.5", 0.333 → "0.33". */
export function formatQuantity(quantity: number): string {
  if (Number.isInteger(quantity)) return formatNumber(quantity)
  return formatNumber(quantity, Number.isInteger(quantity * 10) ? 1 : 2)
}

/** Grams without false precision: whole grams, one decimal below 10 g. */
export function formatPortionGrams(grams: number): string {
  return formatGrams(grams, grams < 10 && !Number.isInteger(grams) ? 1 : 0)
}

/** "150 g", "1 cup (158 g)", "1.5 × 1 cup (237 g)". */
export function formatPortionAmount(portion: Pick<FoodPortion, 'quantity' | 'servingLabel' | 'grams'>): string {
  const grams = formatPortionGrams(portion.grams)
  if (portion.servingLabel === null) return grams
  const unit = servingUnitName(portion.servingLabel)
  return portion.quantity === 1 ? `${unit} (${grams})` : `${formatQuantity(portion.quantity)} × ${unit} (${grams})`
}

/** Grams first, then the food's servings (unique labels), plus the portion's own unit when the food no longer lists it. */
export function unitOptions(servings: readonly ServingOption[], current?: Pick<FoodPortion, 'servingLabel' | 'servingGrams'>): UnitOption[] {
  const options: UnitOption[] = [{ value: GRAMS_UNIT, label: 'grams', grams: null }]
  const all = [...servings]
  if (current?.servingLabel && current.servingGrams) all.push({ label: current.servingLabel, grams: current.servingGrams })
  for (const serving of all) {
    if (!options.some((option) => option.value === servingValue(serving.label))) {
      options.push({ value: servingValue(serving.label), label: serving.label, grams: serving.grams })
    }
  }
  return options
}

export function unitFor(options: readonly UnitOption[], unit: string): UnitOption {
  return options.find((option) => option.value === unit) ?? options[0]!
}

/** One of the food's first serving, else 100 g. */
export function defaultPortionValues(servings: readonly ServingOption[]): PortionValues {
  const first = servings[0]
  return first ? { unit: servingValue(first.label), quantity: 1 } : { unit: GRAMS_UNIT, quantity: DEFAULT_GRAMS }
}

export function portionValuesOf(portion: Pick<FoodPortion, 'quantity' | 'servingLabel' | 'servingGrams' | 'grams'>): PortionValues {
  if (portion.servingLabel === null || portion.servingGrams === null) return { unit: GRAMS_UNIT, quantity: portion.grams }
  return { unit: servingValue(portion.servingLabel), quantity: portion.quantity }
}

/** Values after switching unit: grams keep the current weight, a serving starts at 1. */
export function switchUnit(values: PortionValues, options: readonly UnitOption[], unit: string): PortionValues {
  const next = unitFor(options, unit)
  if (next.grams !== null) return { unit: next.value, quantity: 1 }
  const grams = portionGrams(values, options)
  return { unit: next.value, quantity: grams === null ? DEFAULT_GRAMS : Math.round(grams) }
}

export function portionError(values: PortionValues, options: readonly UnitOption[]): string | null {
  return portionAmountError(values.quantity, unitFor(options, values.unit).grams)
}

/** Total grams for valid values, else null. */
export function portionGrams(values: PortionValues, options: readonly UnitOption[]): number | null {
  if (portionError(values, options) !== null || values.quantity === null) return null
  return gramsForQuantity(values.quantity, unitFor(options, values.unit).grams)
}

/**
 * Portion snapshot of `food` for valid values (else null). Only stored foods are referenced by id; unsaved
 * provider results and rebuilt snapshots keep `foodId: null` (source + external id still identify them).
 */
export function buildPortion(food: FoodItem, values: PortionValues, options: readonly UnitOption[]): FoodPortion | null {
  const grams = portionGrams(values, options)
  if (grams === null || values.quantity === null) return null
  const unit = unitFor(options, values.unit)
  return {
    foodId: !isUnsavedProviderFood(food) && isUuid(food.id) ? food.id : null,
    foodSource: food.source,
    foodExternalId: food.externalId,
    foodName: food.name,
    brand: food.brand,
    quantity: unit.grams === null ? grams : values.quantity,
    servingLabel: unit.grams === null ? null : unit.label,
    servingGrams: unit.grams,
    grams,
    per100g: { ...food.per100g },
  }
}
