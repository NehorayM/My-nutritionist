import { containsHebrew, normalizeHebrew, wordVariants } from './hebrew'
import { CONNECTORS, FOOD_PHRASES, MAX_PHRASE_WORDS, MODIFIERS } from './dictionary'

/** How the English search text was obtained. */
export type TranslationSource = 'dictionary' | 'machine' | 'partial'

export interface QueryTranslation {
  /** The text the user typed (trimmed). */
  original: string
  /** English text sent to the food databases. */
  query: string
  source: TranslationSource
  /** Hebrew words the dictionary does not know (empty when complete). */
  unknown: string[]
}

interface Segment {
  english: string
  kind: 'food' | 'modifier' | 'other'
}

/** Dictionary entry for one phrase, trying the morphological variants of its LAST word and prefixes of its first. */
function lookup(words: readonly string[]): Segment | null {
  const phrase = words.join(' ')
  const direct = FOOD_PHRASES[phrase] ?? null
  if (direct) return { english: direct, kind: 'food' }
  const modifier = MODIFIERS[phrase] ?? null
  if (modifier) return { english: modifier, kind: 'modifier' }
  const first = words[0] ?? ''
  const last = words.at(-1) ?? ''
  const firsts = words.length === 1 ? [first] : wordVariants(first).slice(0, 1 + 6)
  for (const head of firsts) {
    for (const tail of words.length === 1 ? wordVariants(first) : wordVariants(last)) {
      const candidate = words.length === 1 ? tail : [head, ...words.slice(1, -1), tail].join(' ')
      const food = FOOD_PHRASES[candidate]
      if (food) return { english: food, kind: 'food' }
      const mod = MODIFIERS[candidate]
      if (mod) return { english: mod, kind: 'modifier' }
    }
  }
  return null
}

const isConnector = (word: string) => CONNECTORS.has(word) || wordVariants(word).slice(1).some((variant) => CONNECTORS.has(variant) && variant.length >= 2)

/**
 * Dictionary translation of a (partly) Hebrew food query, instantly and offline: the longest known phrases win
 * ("חזה עוף צלוי" → food "chicken breast" + modifier "roasted"), describing words move in front of the food
 * ("roasted chicken breast"), connecting words are dropped and non-Hebrew words (numbers, brands) are kept.
 * Returns null when the text has no Hebrew.
 */
export function translateWithDictionary(text: string): QueryTranslation | null {
  const original = text.trim()
  if (!containsHebrew(original)) return null
  const words = normalizeHebrew(original).split(' ').filter(Boolean)
  const modifiers: string[] = []
  const foods: string[] = []
  const unknown: string[] = []
  for (let i = 0; i < words.length; ) {
    let matched = false
    for (let size = Math.min(MAX_PHRASE_WORDS, words.length - i); size >= 1; size -= 1) {
      const segment = lookup(words.slice(i, i + size))
      if (!segment) continue
      ;(segment.kind === 'modifier' ? modifiers : foods).push(segment.english)
      i += size
      matched = true
      break
    }
    if (matched) continue
    const word = words[i] ?? ''
    if (!containsHebrew(word)) foods.push(word.toLowerCase())
    else if (!isConnector(word)) unknown.push(word)
    i += 1
  }
  const query = [...new Set([...modifiers, ...foods])].join(' ').trim()
  return { original, query, source: unknown.length === 0 ? 'dictionary' : 'partial', unknown }
}
