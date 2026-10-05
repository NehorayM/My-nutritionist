import { MICRO_KEYS, type FoodItem, type NutrientKey, type NutrientProfile } from '@/types'
import type { NutrientTargets } from '../nutrition'
import { NUTRIENTS } from '../nutrients'
import { HIGHLIGHT_DAILY_SHARE, MAX_HIGHLIGHTS } from './constants'
import type { EnergyState, RecommendationStyle } from './types'

/** Nutrients an option can be highlighted for, in display order. */
const HIGHLIGHT_KEYS: readonly NutrientKey[] = ['protein', 'fiber', ...MICRO_KEYS]

/**
 * Nutrients the option supplies at least 20 % of the daily target for (known values only) — today's gaps
 * first, then display order; at most three.
 */
export function optionHighlights(totals: NutrientProfile, targets: NutrientTargets, gaps: readonly NutrientKey[]): NutrientKey[] {
  const meaningful = HIGHLIGHT_KEYS.filter((key) => {
    const target = targets[key]
    const amount = totals[key]
    return target !== undefined && target.amount > 0 && amount !== null && amount >= HIGHLIGHT_DAILY_SHARE * target.amount
  })
  const rank = (key: NutrientKey): number => (gaps.includes(key) ? gaps.indexOf(key) : gaps.length + HIGHLIGHT_KEYS.indexOf(key))
  return [...meaningful].sort((a, b) => rank(a) - rank(b)).slice(0, MAX_HIGHLIGHTS)
}

/** "protein", "vitamin C" — nutrient labels as they read mid-sentence. */
export function nutrientPhrase(key: NutrientKey): string {
  const label = NUTRIENTS[key].label
  return label.charAt(0).toLowerCase() + label.slice(1)
}

/** "a", "a and b", "a, b and c". */
export function joinList(parts: readonly string[]): string {
  if (parts.length <= 1) return parts.join('')
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

const STYLE_LEADS: Readonly<Record<RecommendationStyle, string>> = {
  balanced: 'A balanced option',
  high_protein: 'A protein-rich option',
  quick: 'A quick option',
  no_cook: 'A no-cook option',
  mediterranean: 'A Mediterranean-style option',
  budget: 'A budget-friendly option',
  light: 'A lighter option',
}

export interface ExplanationInput {
  style: RecommendationStyle
  highlights: readonly NutrientKey[]
  energyState: EnergyState
  /** True when the option's energy is within ±15 % of the meal budget. */
  fitsBudget: boolean
}

/**
 * One neutral sentence about why an option fits, e.g. "High in protein and fiber while fitting your remaining
 * calorie target." or "A lighter option that adds fiber and vitamin C."
 */
export function explainOption({ style, highlights, energyState, fitsBudget }: ExplanationInput): string {
  const list = joinList(highlights.map(nutrientPhrase))
  if (style === 'light' || energyState !== 'normal') {
    return list ? `A lighter option that adds ${list}.` : 'A lighter option to round out the day.'
  }
  const fit = fitsBudget ? 'while fitting your remaining calorie target' : 'in a portion sized for this meal'
  if (list) return `High in ${list} ${fit}.`
  return fitsBudget ? `${STYLE_LEADS[style]} that fits your remaining calorie target.` : `${STYLE_LEADS[style]}, in a portion sized for this meal.`
}

/** Short food name: the part before the first comma or parenthesis ("Brown rice, cooked" → "Brown rice"). */
export function shortName(food: Pick<FoodItem, 'name'>): string {
  const short = food.name.split(/[,(]/, 1).join('').trim()
  return short.length > 0 ? short : food.name.trim()
}

/** Words that keep their capital letter mid-title. */
const PROPER_WORDS: ReadonlySet<string> = new Set(['greek', 'israeli', 'medjool', 'mediterranean'])

function lowerFirst(text: string): string {
  const firstWord = text.split(' ', 1).join('').toLowerCase()
  return PROPER_WORDS.has(firstWord) ? text : text.charAt(0).toLowerCase() + text.slice(1)
}

/** Display title from the components: "Chicken breast with brown rice and broccoli". */
export function optionTitle(foods: readonly Pick<FoodItem, 'name'>[]): string {
  const [anchor, ...sides] = foods.map(shortName)
  if (anchor === undefined) return ''
  return sides.length > 0 ? `${anchor} with ${joinList(sides.map(lowerFirst))}` : anchor
}
