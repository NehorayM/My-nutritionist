import { addDays, compareDateKeys } from '@/domain/dates'
import type { ActivityCategory } from '@/types'
import type { CatchUpCardioType } from './constants'
import { rationaleFor } from './catchUpText'
import type { SuggestedType, SuggestionFacts, TextContext } from './catchUpText'
import { followsHardDay, loadByDate, needsRecoveryAfter } from './recovery'
import type { SessionEvent } from './recovery'
import { rankSchedules } from './schedule'
import type { PlannedSlot } from './schedule'
import type { CatchUpSuggestion } from './types'

/** Deterministic suggestion id: date + type + duration (stable across renders, so dismissals stick). */
export function suggestionId(date: string, type: SuggestedType, durationMin: number): string {
  return `catch-up:${date}:${type}:${durationMin}`
}

export interface OptionContext {
  /** Free candidate days, ascending. */
  days: readonly string[]
  /** Sessions per category that still need a day. */
  need: Readonly<Record<ActivityCategory, number>>
  /** Logged workouts and planned scheduled sessions. */
  fixed: readonly SessionEvent[]
  dismissed: ReadonlySet<string>
  text: TextContext
}

export interface OptionVariants {
  preferredCardio: CatchUpCardioType
  variantCardio: CatchUpCardioType
  durationMin: number
  shorterMin: number
}

interface OptionConfig {
  cardio: CatchUpCardioType
  durationMin: number
}

function typeFor(category: ActivityCategory, cardio: CatchUpCardioType): SuggestedType {
  return category === 'strength' ? 'strength' : cardio
}

function search(context: OptionContext, config: OptionConfig, limit: number): PlannedSlot[][] {
  const isBlocked = (slot: PlannedSlot): boolean =>
    context.dismissed.has(suggestionId(slot.date, typeFor(slot.category, config.cardio), config.durationMin))
  return rankSchedules({ days: context.days, need: context.need, fixed: context.fixed, isBlocked }, limit)
}

function toSuggestions(slots: readonly PlannedSlot[], config: OptionConfig, context: OptionContext): CatchUpSuggestion[] {
  const loads = loadByDate(context.fixed)
  const demandingDates = [...loads.entries()].filter(([, load]) => needsRecoveryAfter(load)).map(([date]) => date)
  return slots.map((slot, index) => {
    const before = addDays(slot.date, -1)
    const earlierStrength = slots.slice(0, index).filter((other) => other.category === 'strength')
    const lastDemandingDate =
      [...demandingDates, ...earlierStrength.map((other) => other.date)]
        .filter((date) => compareDateKeys(date, slot.date) < 0)
        .sort(compareDateKeys)
        .pop() ?? null
    const strengthBefore = loads.get(before)?.strength === true || earlierStrength.some((other) => other.date === before)
    const hardBefore = followsHardDay(slot.date, loads)
    const type = typeFor(slot.category, config.cardio)
    const facts: SuggestionFacts = {
      date: slot.date,
      type,
      durationMin: config.durationMin,
      intensity: slot.category === 'cardio' && hardBefore ? 'light' : 'moderate',
      lastDemandingDate,
      dayBefore: hardBefore ? 'hard' : strengthBefore ? 'strength' : null,
    }
    return {
      id: suggestionId(slot.date, type, config.durationMin),
      date: slot.date,
      type,
      category: slot.category,
      durationMin: config.durationMin,
      intensity: facts.intensity,
      rationale: rationaleFor(facts, context.text),
    }
  })
}

/**
 * Complete catch-up options, in preference order: the best day distribution, the next-best distribution,
 * the best plan with the cardio variant, and the best plan with shorter sessions. Every option places the
 * same (largest possible) number of sessions; duplicates and dismissed suggestions are left out.
 */
export function buildCatchUpOptions(
  context: OptionContext,
  variants: OptionVariants,
): { options: CatchUpSuggestion[][]; placed: number } {
  const base: OptionConfig = { cardio: variants.preferredCardio, durationMin: variants.durationMin }
  const cardioVariant: OptionConfig = { ...base, cardio: variants.variantCardio }
  const shorter: OptionConfig = { ...base, durationMin: variants.shorterMin }
  const [best, nextBest] = search(context, base, 2)
  const candidates: Array<[PlannedSlot[] | undefined, OptionConfig]> = [
    [best, base],
    [nextBest, base],
    [search(context, cardioVariant, 1)[0], cardioVariant],
    [search(context, shorter, 1)[0], shorter],
  ]
  const placed = Math.max(...candidates.map(([slots]) => slots?.length ?? 0))
  if (placed === 0) return { options: [], placed }

  const seen = new Set<string>()
  const options: CatchUpSuggestion[][] = []
  for (const [slots, config] of candidates) {
    if (slots?.length !== placed) continue
    const option = toSuggestions(slots, config, context)
    const signature = option.map((suggestion) => suggestion.id).join('|')
    if (seen.has(signature)) continue
    seen.add(signature)
    options.push(option)
  }
  return { options, placed }
}
