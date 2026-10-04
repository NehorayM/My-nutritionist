import type { FoodItem } from '@/types'
import { normalizeSearchText, searchTokens } from './text'

/**
 * Local search ranking: exact name > name prefix > every word matched > substring.
 * Within a tier, names whose first word matches and shorter (more specific) names rank higher;
 * the user's own foods get a boost that never lifts them above a better tier of match.
 */
export const SCORE = {
  exact: 1000,
  exactAnyOrder: 950,
  prefix: 700,
  words: 400,
  partialWords: 150,
  substring: 100,
  exactWordBonus: 20,
  firstWordBonus: 40,
  extraWordPenalty: 4,
  maxExtraWordPenalty: 40,
  userFoodBoost: 150,
} as const

export interface IndexedFood {
  food: FoodItem
  isUserFood: boolean
  nameText: string
  nameTokens: string[]
  brandTokens: string[]
}

export interface PreparedQuery {
  text: string
  tokens: string[]
}

export function indexFood(food: FoodItem, isUserFood: boolean): IndexedFood {
  return {
    food,
    isUserFood,
    nameText: normalizeSearchText(food.name),
    nameTokens: searchTokens(food.name),
    brandTokens: food.brand === null ? [] : searchTokens(food.brand),
  }
}

/** Null when the text has no searchable characters. */
export function prepareQuery(text: string): PreparedQuery | null {
  const tokens = searchTokens(text)
  return tokens.length === 0 ? null : { text: normalizeSearchText(text), tokens }
}

/** 3 = whole word, 2 = word prefix, 1 = inside a word (≥ 3 chars), 0 = no match. */
function tokenStrength(queryToken: string, tokens: string[]): number {
  let best = 0
  for (const token of tokens) {
    if (token === queryToken) return 3
    if (token.startsWith(queryToken)) best = Math.max(best, 2)
    else if (queryToken.length >= 3 && token.includes(queryToken)) best = Math.max(best, 1)
  }
  return best
}

function sameTokenSet(a: string[], b: string[]): boolean {
  const left = new Set(a)
  const right = new Set(b)
  return left.size === right.size && [...left].every((token) => right.has(token))
}

function baseScore(query: PreparedQuery, entry: IndexedFood): number {
  const queryJoined = query.tokens.join(' ')
  const nameJoined = entry.nameTokens.join(' ')
  if (nameJoined === queryJoined) return SCORE.exact
  if (sameTokenSet(entry.nameTokens, query.tokens)) return SCORE.exactAnyOrder
  if (nameJoined.startsWith(queryJoined)) return SCORE.prefix
  let exactWords = 0
  let weakest = 3
  for (const token of query.tokens) {
    const nameStrength = tokenStrength(token, entry.nameTokens)
    // A brand match counts, but never as strongly as a match in the food name.
    const brandStrength = Math.min(tokenStrength(token, entry.brandTokens), 1)
    const strength = Math.max(nameStrength, brandStrength)
    if (nameStrength === 3) exactWords += 1
    weakest = Math.min(weakest, strength)
  }
  if (weakest >= 2) return SCORE.words + exactWords * SCORE.exactWordBonus
  if (weakest === 1) return SCORE.partialWords + exactWords * SCORE.exactWordBonus
  if (query.text.length >= 3 && entry.nameText.includes(query.text)) return SCORE.substring
  return 0
}

/** Relevance of a food for a query; 0 means "not a match". */
export function scoreFood(query: PreparedQuery, entry: IndexedFood): number {
  const base = baseScore(query, entry)
  if (base === 0) return 0
  const [firstQuery] = query.tokens
  const [firstName] = entry.nameTokens
  const firstWordBonus =
    firstQuery !== undefined && firstName !== undefined && firstName.startsWith(firstQuery) ? SCORE.firstWordBonus : 0
  const extraWords = Math.max(0, entry.nameTokens.length - query.tokens.length)
  const specificity = Math.min(extraWords * SCORE.extraWordPenalty, SCORE.maxExtraWordPenalty)
  return base + firstWordBonus - specificity + (entry.isUserFood ? SCORE.userFoodBoost : 0)
}

/** Deterministic ordering: score, shorter name, alphabetical, id. */
export function compareRanked(a: { score: number; entry: IndexedFood }, b: { score: number; entry: IndexedFood }): number {
  return (
    b.score - a.score ||
    a.entry.food.name.length - b.entry.food.name.length ||
    a.entry.food.name.localeCompare(b.entry.food.name) ||
    a.entry.food.id.localeCompare(b.entry.food.id)
  )
}
