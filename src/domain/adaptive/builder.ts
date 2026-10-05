import type { FoodItem } from '@/types'
import { createPools } from './combos'
import { alternativesFor, byScore, type OptionDraft } from './compose'
import { MIN_RECOMMENDATIONS } from './constants'
import type { RankingContext } from './context'
import { optionPool } from './diets'
import { dishName, dismissedSignatures } from './dishes'
import { rankSides } from './pool'
import { stylesByRelevance } from './styles'

export { byScore, type OptionDraft } from './compose'

export interface BuildOptionsInput {
  candidates: readonly FoodItem[]
  ctx: RankingContext
  dismissedIds: ReadonlySet<string>
  /** "View alternative" counter; each style rotates through its alternatives with it. */
  variant: number
}

export interface BuiltOptions {
  options: OptionDraft[]
  /** True when at least one option was left out because the user dismissed it. */
  dismissedAny: boolean
}

/** Index of the alternative shown for `variant` (any integer, negative included; non-finite → 0). */
export function rotationIndex(variant: number, length: number): number {
  if (length === 0) return 0
  const step = Number.isFinite(variant) ? Math.trunc(variant) : 0
  return ((step % length) + length) % length
}

/** Fill up to the minimum list length with the best spare alternatives (distinct signatures only). */
function fillToMinimum(options: OptionDraft[], spare: readonly OptionDraft[], chosen: Set<string>): void {
  for (const option of [...spare].sort(byScore)) {
    if (options.length >= MIN_RECOMMENDATIONS) return
    if (chosen.has(option.signature)) continue
    options.push(option)
    chosen.add(option.signature)
  }
}

/** Options whose anchor dish carries no option yet, or all of them when every anchor is taken. */
function preferFreshAnchors(options: readonly OptionDraft[], anchored: ReadonlySet<string>): readonly OptionDraft[] {
  const fresh = options.filter((option) => !anchored.has(option.anchorDish))
  return fresh.length > 0 ? fresh : options
}

/**
 * Meal builder: one option per satisfiable style (anchor + up to two sides; snacks and the light style take one
 * side), portions sized to the budget. Styles are built in order of relevance to today's gaps, so the most
 * relevant styles claim the best foods; dishes already shown — above all as another option's anchor — rank lower
 * for later styles, and an alternative with an anchor not yet shown is preferred. Options that read like one
 * already chosen (same dish names) are skipped, and so are dismissed options — matched by id, or by dish names
 * for this meal so a dismissed option never returns under another style; `variant` rotates each style's
 * alternatives. When fewer than three styles can be satisfied, spare alternatives fill the list up to three.
 * Options are composed from the diet's preferred foods (`optionPool`).
 */
export function buildMealOptions(input: BuildOptionsInput): BuiltOptions {
  const candidates = optionPool(input.candidates, input.ctx.prefs.dietType)
  const pools = createPools(candidates, rankSides(candidates, input.ctx))
  const dismissed = dismissedSignatures(input.dismissedIds, input.candidates, input.ctx.mealType)
  const isDismissed = (option: OptionDraft): boolean => input.dismissedIds.has(option.id) || dismissed.has(option.signature)
  const used = new Map<string, number>()
  const anchored = new Set<string>()
  const chosen = new Set<string>()
  const options: OptionDraft[] = []
  const spare: OptionDraft[] = []
  let dismissedAny = false
  const signals = { gaps: input.ctx.gaps, energyState: input.ctx.energyState, prefs: input.ctx.prefs }
  for (const { style, relevance } of stylesByRelevance(signals)) {
    const alternatives = alternativesFor({ style, relevance, ctx: input.ctx, used, anchored }, pools)
    const visible = alternatives.filter((option) => !isDismissed(option))
    if (visible.length < alternatives.length) dismissedAny = true
    const available = visible.filter((option) => !chosen.has(option.signature))
    const choices = preferFreshAnchors(available, anchored)
    const pick = choices[rotationIndex(input.variant, choices.length)]
    if (pick === undefined) continue
    options.push(pick)
    chosen.add(pick.signature)
    anchored.add(pick.anchorDish)
    spare.push(...available.filter((option) => option !== pick))
    for (const item of pick.items) {
      const dish = dishName(item.food)
      used.set(dish, (used.get(dish) ?? 0) + 1)
    }
  }
  fillToMinimum(options, spare, chosen)
  return { options, dismissedAny }
}
