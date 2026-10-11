import type { MealType, PantryItem } from '@/types'
import { MAX_ITEMS, TOP_ITEMS_PER_ROLE, USE_SOON_DAYS } from './constants'
import { usesSoon } from './feasibility'
import { plateRole, proteinShare, type PlateRole } from './roles'

/** Roles a meal may contain at most once (vegetables may appear twice). */
const ROLE_LIMIT: Readonly<Partial<Record<PlateRole, number>>> = { veg: 2 }

/** A plate worth suggesting: main meals need a protein, a dish, or dairy with a starch/fruit; snacks anything. */
function isMealLike(roles: readonly PlateRole[], meal: MealType): boolean {
  if (meal === 'snack') return roles.length > 0
  const has = (role: PlateRole) => roles.includes(role)
  if (has('protein') || has('dish')) return true
  return has('dairy') && (has('carb') || has('fruit'))
}

/** Preference among items of one role: use-soon first, then protein density, then name (deterministic). */
function rank(today: string) {
  return (a: PantryItem, b: PantryItem) =>
    Number(usesSoon(b, today, USE_SOON_DAYS)) - Number(usesSoon(a, today, USE_SOON_DAYS)) ||
    proteinShare(b.food) - proteinShare(a.food) ||
    a.food.name.localeCompare(b.food.name) ||
    a.id.localeCompare(b.id)
}

/**
 * Candidate plates for a meal from the items that can be part of it: every combination of 1…4 items (1…2 for
 * snacks) with at most one item per role (two vegetables allowed), keeping the best few items per role.
 */
export function mealCombos(items: readonly PantryItem[], meal: MealType, today: string): PantryItem[][] {
  const byRole = new Map<PlateRole, PantryItem[]>()
  for (const item of [...items].sort(rank(today))) {
    const role = plateRole(item.food)
    const list = byRole.get(role) ?? []
    if (list.length < TOP_ITEMS_PER_ROLE) list.push(item)
    byRole.set(role, list)
  }
  const pool = [...byRole.values()].flat()
  const max = MAX_ITEMS[meal === 'snack' ? 'snack' : 'main']
  const combos: PantryItem[][] = []
  const walk = (start: number, chosen: PantryItem[], roles: PlateRole[]) => {
    if (chosen.length > 0 && isMealLike(roles, meal)) combos.push([...chosen])
    if (chosen.length === max) return
    for (let i = start; i < pool.length; i += 1) {
      const item = pool[i] as PantryItem
      const role = plateRole(item.food)
      const count = roles.filter((r) => r === role).length
      if (count >= (ROLE_LIMIT[role] ?? 1)) continue
      chosen.push(item)
      roles.push(role)
      walk(i + 1, chosen, roles)
      chosen.pop()
      roles.pop()
    }
  }
  walk(0, [], [])
  return combos
}
