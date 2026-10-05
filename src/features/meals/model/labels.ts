import type { Tone } from '@/components/ui'
import { DEFAULT_MEAL_SLOTS, mealLabel } from '@/domain/meals'
import type { FoodProviderError, FoodProviderId, ProviderStatus } from '@/services/food'
import type { Allergen, FoodItem, FoodSource, MealType } from '@/types'

export const MEAL_OPTIONS = DEFAULT_MEAL_SLOTS.map((slot) => ({ value: slot.key, label: slot.label }))

/** "breakfast" → "breakfast", "snack" → "snacks" (for sentences like "Repeat yesterday's snacks"). */
export function mealNoun(mealType: MealType): string {
  return mealLabel(mealType).toLowerCase()
}

function repeatPhrase(mealType: MealType, previousLabel: string): string {
  return previousLabel === 'Yesterday' ? `yesterday’s ${mealNoun(mealType)}` : `${mealNoun(mealType)} from ${previousLabel}`
}

/** "Repeat yesterday’s breakfast" / "Repeat snacks from Thu, Oct 1" (`previousLabel` from formatDateLabel). */
export function repeatLabelFor(mealType: MealType, previousLabel: string): string {
  return `Repeat ${repeatPhrase(mealType, previousLabel)}`
}

/** Confirmation after repeating: "Repeated yesterday’s breakfast". */
export function repeatedMessageFor(mealType: MealType, previousLabel: string): string {
  return `Repeated ${repeatPhrase(mealType, previousLabel)}`
}

export const SOURCE_LABELS: Record<FoodSource, string> = {
  system: 'Catalog',
  usda: 'USDA',
  off: 'Open Food Facts',
  custom: 'Mine',
}

export const SOURCE_TONES: Record<FoodSource, Tone> = {
  system: 'neutral',
  usda: 'info',
  off: 'accent',
  custom: 'primary',
}

export function sourceLabel(food: Pick<FoodItem, 'source'>): string {
  return SOURCE_LABELS[food.source]
}

const PROVIDER_NAMES: Record<FoodProviderId, string> = {
  local: 'The food catalog',
  usda: 'USDA search',
  off: 'Packaged product search',
}

function waitText(error: FoodProviderError | undefined): string {
  const ms = error?.retryAfterMs
  if (ms === null || ms === undefined || ms <= 0) return 'Try again in a minute.'
  const seconds = Math.ceil(ms / 1000)
  return seconds <= 90 ? `Try again in ${seconds} s.` : 'Try again in a few minutes.'
}

/**
 * Short, neutral explanation of a provider outcome, or null when there is nothing to say
 * ('ok', 'skipped', 'aborted'). Other providers' results stay visible alongside it.
 */
export function providerStatusMessage(
  providerId: FoodProviderId,
  status: ProviderStatus,
  error?: FoodProviderError,
): string | null {
  const name = PROVIDER_NAMES[providerId]
  switch (status) {
    case 'ok':
    case 'skipped':
    case 'aborted':
      return null
    case 'network':
      return `${name} couldn’t be reached. Check your connection; foods on this device still work.`
    case 'timeout':
      return `${name} took too long to answer. Try again in a moment.`
    case 'rate_limited':
      return providerId === 'off'
        ? `Packaged product search allows about 10 searches a minute. ${waitText(error)}`
        : `${name} is busy right now. ${waitText(error)}`
    case 'unavailable':
      return `${name} isn’t available right now.`
    case 'http':
    case 'invalid_response':
      return `${name} had a problem answering. Try again later.`
  }
}

export const ALLERGEN_LABELS: Record<Allergen, string> = {
  milk: 'Milk',
  egg: 'Egg',
  fish: 'Fish',
  shellfish: 'Shellfish',
  tree_nuts: 'Tree nuts',
  peanuts: 'Peanuts',
  wheat: 'Wheat',
  gluten: 'Gluten',
  soy: 'Soy',
  sesame: 'Sesame',
}

/** "Today" → "today" inside a sentence; other labels ("Sat, Oct 3") stay as they are. */
export function inSentence(dayLabel: string): string {
  return dayLabel === 'Today' || dayLabel === 'Yesterday' ? dayLabel.toLowerCase() : dayLabel
}
