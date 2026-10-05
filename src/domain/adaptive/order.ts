/** Deterministic orderings shared by the composer and the candidate pools. */

/** Code-unit order of two ids (locale-independent, so results never depend on the device). */
export function compareIds(a: string, b: string): number {
  if (a === b) return 0
  return a < b ? -1 : 1
}

/** Best score first; equal scores by food id. */
export function byScoreThenFoodId<T extends { food: { id: string }; score: number }>(a: T, b: T): number {
  return b.score - a.score || compareIds(a.food.id, b.food.id)
}
