import { uuidV5, userFoodId } from '@/lib/id'
import type { FoodItem, FoodSource } from '@/types'

/** Provider sources whose results are not persisted until the user saves/favorites them. */
export type ProviderFoodSource = Extract<FoodSource, 'usda' | 'off'>

/** A normalized provider result before it receives its transient id and timestamps. */
export type ProviderFoodDraft = Omit<FoodItem, 'id' | 'createdAt' | 'updatedAt'> & {
  source: ProviderFoodSource
  externalId: string
}

/**
 * Transient, deterministic id for an UNSAVED provider result: the same USDA fdcId / OFF barcode always gets
 * the same id (stable React keys, cache-friendly), and it never collides with system or user food ids
 * because the UUIDv5 name is namespaced with "provider:".
 *
 * Unsaved provider foods must not be referenced as `foodId` (meal entries snapshot them with `foodId: null`).
 * Favoriting or saving one persists a user-owned copy via `toSavedProviderFood`, whose id is
 * `userFoodId(userId, source, externalId)` — idempotent, so saving twice never duplicates.
 */
export function providerFoodId(source: ProviderFoodSource, externalId: string): Promise<string> {
  return uuidV5(`provider:${source}:${externalId}`)
}

/** Assigns the transient id and timestamps to a draft. */
export async function toProviderFood(draft: ProviderFoodDraft, timestamp: string): Promise<FoodItem> {
  const id = await providerFoodId(draft.source, draft.externalId)
  return { ...draft, id, createdAt: timestamp, updatedAt: timestamp }
}

export function toProviderFoods(drafts: ProviderFoodDraft[], timestamp: string): Promise<FoodItem[]> {
  return Promise.all(drafts.map((draft) => toProviderFood(draft, timestamp)))
}

/** True for a USDA/Open Food Facts result that has not been saved as a user food yet. */
export function isUnsavedProviderFood(food: FoodItem): boolean {
  return (food.source === 'usda' || food.source === 'off') && food.createdBy === null
}

/**
 * User-owned copy of a provider food (for favorites / "save food"). Persist it with the food repository;
 * the deterministic id makes repeated saves idempotent upserts.
 */
export async function toSavedProviderFood(food: FoodItem, userId: string, timestamp: string): Promise<FoodItem> {
  if (food.source !== 'usda' && food.source !== 'off') {
    throw new Error('Only USDA or Open Food Facts results can be saved as provider foods')
  }
  if (food.externalId === null) throw new Error('Provider food is missing its external id')
  const id = await userFoodId(userId, food.source, food.externalId)
  return { ...food, id, createdBy: userId, createdAt: timestamp, updatedAt: timestamp }
}
