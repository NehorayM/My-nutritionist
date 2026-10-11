import type { MealGap, PantryExclusion } from '@/domain/planner'
import { formatNumber } from '@/lib/format'
import type { KitchenEquipment, PantryItem, PantryPrep } from '@/types'

export const EQUIPMENT_LABELS: Record<KitchenEquipment, string> = { microwave: 'Microwave', stove: 'Stove', oven: 'Oven' }

export const PREP_LABELS: Record<PantryPrep, string> = { ready: 'Ready to eat', reheat: 'Warm up', cook: 'Cook from raw' }

export const PREP_HINTS: Record<PantryPrep, string> = {
  ready: 'Eaten as is (fruit, yogurt, bread, salads…)',
  reheat: 'Already cooked, just needs warming (leftovers)',
  cook: 'Needs cooking (raw chicken, dry rice…)',
}

export function equipmentList(items: readonly KitchenEquipment[]): string {
  return items.map((item) => EQUIPMENT_LABELS[item].toLowerCase()).join(', ')
}

/** "400 g", "6 × 1 large egg (50 g)" or "Some". */
export function amountText(item: Pick<PantryItem, 'grams' | 'servingLabel' | 'servingGrams'>): string {
  if (item.grams === null) return 'Some (amount not tracked)'
  if (item.servingLabel && item.servingGrams) {
    const count = item.grams / item.servingGrams
    return `${formatNumber(count, Number.isInteger(count) ? 0 : 1)} × ${item.servingLabel}`
  }
  return `${formatNumber(item.grams)} g`
}

export function prepText(item: Pick<PantryItem, 'prep' | 'cookMinutes' | 'methods'>): string {
  if (item.prep === 'ready') return PREP_LABELS.ready
  const tools = equipmentList(item.methods)
  if (item.prep === 'reheat') return `Warm up · ${tools}`
  return `Cook ${item.cookMinutes ?? 0} min · ${tools}`
}

export const EXCLUSION_TEXT: Record<PantryExclusion, string> = {
  incomplete_nutrition: 'calories unknown',
  expired: 'past its use-by date',
  used_up: 'almost used up',
  condiment: 'left out of plans (a condiment — it goes with a meal rather than being one)',
  alcohol: 'left out of plans (alcoholic drinks are never planned)',
  occasional: 'left out of plans (an occasional food — add it to favorites to include it)',
  allergen: 'contains an allergen from your profile',
  allergen_unknown: 'allergen information unknown',
  diet: 'doesn’t match your diet setting',
}

/** Why a meal has no option, in plain words. */
export function gapText(gap: MealGap, range: { min: number; max: number }): string {
  switch (gap) {
    case 'disabled':
      return 'Not planned.'
    case 'nothing_available':
      return 'Nothing in your kitchen can be used yet. Add some items to plan this meal.'
    case 'no_equipment':
      return 'What’s at home needs equipment that isn’t available at this meal.'
    case 'no_cooking':
      return 'What’s at home needs cooking, and cooking is off for this meal. Add ready-to-eat food or allow cooking.'
    case 'not_enough_time':
      return 'Everything available takes longer than the time you have for this meal.'
    case 'calories_out_of_reach':
      return `What’s available can’t make a meal of ${formatNumber(range.min)}–${formatNumber(range.max)} kcal. Add more food or adjust the calorie range.`
  }
}
