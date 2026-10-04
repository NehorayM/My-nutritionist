import type { FoodItem } from '@/types'
import { barcodeMatchKey } from '../normalize/barcode'
import { nameIdentityKey, normalizeSearchText } from './text'

/** Extra identity for a food, e.g. the USDA record a catalog food was built from ("usda:171477"). */
export type LinkedRecordKey = (food: FoodItem) => string | null

/**
 * Cross-provider de-duplication. Two foods are the same when they share a barcode (leading zeros ignored),
 * the same provider record (source + external id, e.g. a saved USDA food and the same USDA result; or a catalog
 * food and the USDA record it was built from, via `linkedKey`), or the same normalized name + brand
 * ("Cheese, cheddar" ≡ "Cheddar cheese").
 */
export function foodDedupeKeys(food: FoodItem, linkedKey?: LinkedRecordKey): string[] {
  const keys: string[] = []
  const linked = linkedKey?.(food) ?? null
  if (linked !== null) keys.push(linked)
  const barcode = barcodeMatchKey(food.barcode)
  if (barcode !== null) keys.push(`barcode:${barcode}`)
  if ((food.source === 'usda' || food.source === 'off') && food.externalId !== null) {
    keys.push(`${food.source}:${food.externalId}`)
  }
  if (normalizeSearchText(food.name) !== '') keys.push(`name:${nameIdentityKey(food.name, food.brand)}`)
  return keys
}

/**
 * Returns the candidates that do not duplicate any `known` food or an earlier candidate, in order.
 * Local results are passed as `known` so the user's own and catalog foods always win over remote copies.
 */
export function uniqueAgainst(
  known: readonly FoodItem[],
  candidates: readonly FoodItem[],
  linkedKey?: LinkedRecordKey,
): FoodItem[] {
  const seen = new Set<string>()
  for (const food of known) for (const key of foodDedupeKeys(food, linkedKey)) seen.add(key)
  const unique: FoodItem[] = []
  for (const food of candidates) {
    const keys = foodDedupeKeys(food, linkedKey)
    if (keys.some((key) => seen.has(key))) continue
    for (const key of keys) seen.add(key)
    unique.push(food)
  }
  return unique
}
