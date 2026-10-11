import { DAIRY } from './dairy'
import { DISHES } from './dishes'
import { GRAINS } from './grains'
import { CONNECTORS, MODIFIERS } from './modifiers'
import { PANTRY } from './pantry'
import { PRODUCE } from './produce'
import { PROTEINS } from './proteins'

/** Every food phrase (1–4 Hebrew words) → English. Later groups never override earlier ones. */
export const FOOD_PHRASES: Readonly<Record<string, string>> = { ...PANTRY, ...DISHES, ...PRODUCE, ...GRAINS, ...DAIRY, ...PROTEINS }

export { CONNECTORS, MODIFIERS }

/** Longest phrase length in words (bounds the phrase search). */
export const MAX_PHRASE_WORDS = Math.max(
  ...[...Object.keys(FOOD_PHRASES), ...Object.keys(MODIFIERS)].map((phrase) => phrase.split(' ').length),
)
