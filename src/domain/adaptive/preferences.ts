import type { Profile } from '@/types'
import { createDefaultProfile } from '../profile'

/** Profile fields the Adaptive Nutrition Engine reads (a full `Profile` satisfies this). */
export type AdaptivePreferences = Pick<
  Profile,
  'dietType' | 'allergies' | 'dislikes' | 'preferredCuisines' | 'maxPrepMinutes' | 'cookingSkill'
>

/** Fixed timestamp for the defaults template (never shown or stored). */
const TEMPLATE_INSTANT = '1970-01-01T00:00:00.000Z'
const DEFAULTS: AdaptivePreferences = createDefaultProfile('defaults', TEMPLATE_INSTANT)

/**
 * Preferences with app defaults when no profile exists yet (balanced, no allergies or dislikes, 30-minute prep,
 * intermediate cook). A non-finite or negative prep limit falls back to the default.
 */
export function resolvePreferences(profile: AdaptivePreferences | null): AdaptivePreferences {
  const source = profile ?? DEFAULTS
  const prep = source.maxPrepMinutes
  return {
    dietType: source.dietType,
    allergies: [...source.allergies],
    dislikes: source.dislikes.map((dislike) => dislike.trim()).filter((dislike) => dislike.length > 0),
    preferredCuisines: [...source.preferredCuisines],
    maxPrepMinutes: Number.isFinite(prep) && prep >= 0 ? prep : DEFAULTS.maxPrepMinutes,
    cookingSkill: source.cookingSkill,
  }
}

/** Lower-case words of a text; underscores and punctuation separate words ("fast_food" → fast, food). */
function words(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 0)
}

/** Light singular form so "eggs" matches "egg" and "tomatoes" matches "tomato" (applied to both sides). */
function singular(word: string): string {
  if (word.length > 4 && word.endsWith('ies')) return `${word.slice(0, -3)}y`
  if (word.length > 4 && word.endsWith('oes')) return word.slice(0, -2)
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1)
  return word
}

function normalizedWords(text: string): string[] {
  return words(text).map(singular)
}

/**
 * Case-insensitive whole-word match: every word of `phrase`, in order and adjacent, appears in `text`.
 * "egg" matches "Egg, hard-boiled" and the tag "egg_white", but not "eggplant".
 */
export function containsPhrase(text: string, phrase: string): boolean {
  const needle = normalizedWords(phrase)
  if (needle.length === 0) return false
  const haystack = normalizedWords(text)
  for (let start = 0; start + needle.length <= haystack.length; start += 1) {
    if (needle.every((word, offset) => haystack[start + offset] === word)) return true
  }
  return false
}
