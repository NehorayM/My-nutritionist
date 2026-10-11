import { defaultPrepFor } from '@/domain/planner'
import { LIMITS } from '@/schemas'
import type { FoodItem, KitchenEquipment, PantryItem, PantryPrep } from '@/types'
import type { PantryInput } from '@/stores/kitchenStore'

/** Editable state of the pantry item form. */
export interface PantryFormValues {
  food: FoodItem | null
  tracked: boolean
  /** Amount in `unit`; null while empty. */
  amount: number | null
  /** 'g' or the index of one of the food's servings. */
  unit: string
  prep: PantryPrep
  cookMinutes: number | null
  methods: KitchenEquipment[]
  useBy: string
}

export function emptyForm(): PantryFormValues {
  return { food: null, tracked: true, amount: null, unit: 'g', prep: 'ready', cookMinutes: null, methods: [], useBy: '' }
}

/** A food was picked: sensible defaults for how it is eaten and an amount in its first household unit. */
export function formForFood(food: FoodItem): PantryFormValues {
  const prep = defaultPrepFor(food)
  const unit = food.servings.length > 0 ? '0' : 'g'
  return { ...emptyForm(), food, unit, amount: unit === 'g' ? 500 : 1, prep: prep.prep, cookMinutes: prep.cookMinutes, methods: prep.methods }
}

export function formForItem(item: PantryItem): PantryFormValues {
  const servingIndex = item.servingLabel === null ? -1 : item.food.servings.findIndex((s) => s.label === item.servingLabel)
  const unit = servingIndex >= 0 ? String(servingIndex) : 'g'
  const servingGrams = servingIndex >= 0 ? (item.food.servings[servingIndex]?.grams ?? null) : null
  return {
    food: item.food,
    tracked: item.grams !== null,
    amount: item.grams === null ? null : servingGrams ? Math.round((item.grams / servingGrams) * 10) / 10 : item.grams,
    unit,
    prep: item.prep,
    cookMinutes: item.cookMinutes,
    methods: item.methods,
    useBy: item.useBy ?? '',
  }
}

/** A problem to show next to the form, or null when it can be saved. */
export function formError(values: PantryFormValues): string | null {
  if (!values.food) return 'Pick a food first.'
  if (values.tracked && (values.amount === null || values.amount <= 0)) return 'Enter how much you have, or choose “I don’t track the amount”.'
  if (values.prep !== 'ready' && values.methods.length === 0) return 'Pick how it can be warmed or cooked.'
  if (values.prep === 'cook') {
    const minutes = values.cookMinutes
    if (minutes === null || minutes < LIMITS.cookMinutes.min || minutes > LIMITS.cookMinutes.max) return 'Enter a cooking time of 1–600 minutes.'
  }
  return null
}

/** The values as a pantry item (call only when `formError` is null). */
export function toPantryInput(values: PantryFormValues): PantryInput {
  const food = values.food as FoodItem
  const serving = values.unit === 'g' ? null : (food.servings[Number(values.unit)] ?? null)
  const grams = values.tracked && values.amount !== null ? Math.round(values.amount * (serving?.grams ?? 1) * 10) / 10 : null
  return {
    food,
    grams: grams === null ? null : Math.min(LIMITS.pantryGrams.max, grams),
    servingLabel: grams !== null && serving ? serving.label : null,
    servingGrams: grams !== null && serving ? serving.grams : null,
    prep: values.prep,
    cookMinutes: values.prep === 'cook' ? Math.round(values.cookMinutes ?? 0) : null,
    methods: values.prep === 'ready' ? [] : values.methods,
    useBy: values.useBy === '' ? null : values.useBy,
  }
}
