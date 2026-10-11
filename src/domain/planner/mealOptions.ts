import type { KitchenEquipment, MealConstraint, MealType, PantryItem } from '@/types'
import { DAY_CANDIDATES_PER_MEAL, USE_SOON_DAYS } from './constants'
import { mealCombos } from './combos'
import { equipmentFor, mealBlock, mealMinutes, usesSoon, type MealBlock } from './feasibility'
import { sizePortions } from './portions'
import type { KcalRange } from './ranges'
import { scoreOption, totalsOf } from './score'
import type { MealGap, MealOption } from './types'

export interface MealOptionsInput {
  meal: MealType
  constraint: MealConstraint
  equipment: readonly KitchenEquipment[]
  items: readonly PantryItem[]
  range: KcalRange
  today: string
  variant: number
}

export interface MealOptionsResult {
  options: MealOption[]
  gap: MealGap | null
}

function optionId(meal: MealType, sized: readonly { item: PantryItem; grams: number }[]): string {
  return [meal, ...sized.map(({ item, grams }) => `${item.id}@${grams}`).sort()].join('|')
}

/** The most common reason items can't be part of this meal (for the "why no option" message). */
function mainBlock(blocks: readonly MealBlock[]): MealBlock | null {
  const counts = new Map<MealBlock, number>()
  for (const block of blocks) counts.set(block, (counts.get(block) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null
}

/** A plate's lead item (most energy): options with the same lead are alternatives of one idea. */
const leadOf = (option: MealOption) => [...option.items].sort((a, b) => b.kcal - a.kcal)[0]?.pantryItemId ?? ''

/**
 * Valid options for one meal, best first and varied (different lead items first). Every option uses only the
 * given pantry items, within what is at home, with equipment available at the meal, cooking only when allowed,
 * within the time budget, and lands in the meal's calorie range.
 */
export function buildMealOptions(input: MealOptionsInput): MealOptionsResult {
  const { meal, constraint, equipment, range, today, variant } = input
  if (!constraint.enabled) return { options: [], gap: 'disabled' }
  const usable: PantryItem[] = []
  const blocks: MealBlock[] = []
  for (const item of input.items) {
    const block = mealBlock(item, constraint, equipment)
    if (block === null) usable.push(item)
    else blocks.push(block)
  }
  if (usable.length === 0) return { options: [], gap: input.items.length === 0 ? 'nothing_available' : (mainBlock(blocks) ?? 'nothing_available') }

  const options: MealOption[] = []
  for (const combo of mealCombos(usable, meal, today)) {
    if (mealMinutes(combo) > constraint.maxMinutes) continue
    const sized = sizePortions(combo, range)
    if (!sized) continue
    const totals = totalsOf(sized)
    const id = optionId(meal, sized)
    options.push({
      id,
      mealType: meal,
      items: sized.map((entry) => ({
        pantryItemId: entry.item.id,
        food: entry.item.food,
        grams: entry.grams,
        quantity: entry.quantity,
        servingLabel: entry.servingLabel,
        servingGrams: entry.servingGrams,
        prep: entry.item.prep,
        equipment: equipmentFor(entry.item, equipment),
        kcal: Math.round(entry.kcal),
      })),
      totals,
      prepMinutes: mealMinutes(combo),
      usesSoon: combo.some((item) => usesSoon(item, today, USE_SOON_DAYS)),
      score: scoreOption({ meal, items: sized, totals, range, today, variant, id }),
    })
  }
  if (options.length === 0) return { options: [], gap: 'calories_out_of_reach' }
  options.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
  // Varied first: one option per lead item, then the rest.
  const seen = new Set<string>()
  const varied = options.filter((option) => !seen.has(leadOf(option)) && seen.add(leadOf(option)))
  const rest = options.filter((option) => !varied.includes(option))
  return { options: [...varied, ...rest].slice(0, DAY_CANDIDATES_PER_MEAL), gap: null }
}
