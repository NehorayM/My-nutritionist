import type { FoodItem, MealType } from '@/types'
import { proteinEnergyShare } from './diets'
import { memoize } from './memo'

/**
 * Culinary roles: food categories refined so options read like everyday plates.
 * - cereal: grains eaten only at breakfast or as a snack (oats, flakes, granola) — split from breads and cooked grains;
 * - cheese: energy-dense dairy (≥ 200 kcal/100 g) — split from yogurt, milk and cottage cheese;
 * - dish:   complete dishes (fast food, prepared and Israeli dishes with ≥ 15 % of energy from protein, e.g. shakshuka,
 *           shawarma) — they carry an option and are never added as a side.
 */
export type ComponentRole = NonNullable<FoodItem['category']> | 'cereal' | 'cheese' | 'dish'
type MealKind = 'breakfast' | 'main' | 'snack'
type RoleTable = Readonly<Partial<Record<ComponentRole, readonly ComponentRole[]>>>

/** Main-meal anchors carry at least 15 % of their energy as protein (breads and cereals may anchor breakfast). */
export const MAIN_ANCHOR_PROTEIN_SHARE = 0.15
/** Dairy at or above this energy density is cheese. */
export const CHEESE_KCAL_PER_100G = 200
/** A wheat-based food with at least this much carbohydrate per 100 g is a bread base (pita, pizza, pastry). */
export const STARCH_BASE_CARBS_G = 15

const DISH_CATEGORIES: ReadonlyArray<FoodItem['category']> = ['fast_food', 'prepared', 'israeli']

/**
 * Which roles go together in one option (read both ways). App convention for recognisable plates: cereal with
 * dairy and fruit, eggs with bread and vegetables, chicken with grains and vegetables, shakshuka with pita and
 * salad, yogurt with fruit and nuts. Uncategorized (user) foods pair with anything.
 */
const PAIRS: Readonly<Record<MealKind, RoleTable>> = {
  breakfast: {
    cereal: ['dairy', 'fruit', 'nut_seed', 'beverage'],
    grain: ['dairy', 'cheese', 'protein', 'vegetable', 'fat', 'israeli', 'dish', 'nut_seed', 'beverage'],
    dairy: ['fruit', 'nut_seed', 'vegetable', 'beverage'],
    cheese: ['vegetable', 'fruit', 'dish', 'beverage'],
    protein: ['vegetable', 'cheese', 'israeli', 'fruit', 'beverage'],
    dish: ['vegetable', 'israeli', 'beverage'],
    israeli: ['vegetable', 'israeli', 'beverage'],
    fruit: ['nut_seed'],
    vegetable: ['vegetable', 'fat'],
    legume: ['vegetable'],
  },
  main: {
    protein: ['vegetable', 'grain', 'legume', 'fat', 'israeli'],
    legume: ['vegetable', 'grain', 'fat', 'israeli', 'cheese'],
    grain: ['vegetable', 'fat', 'israeli', 'cheese', 'dish'],
    dish: ['vegetable', 'israeli'],
    cheese: ['vegetable'],
    dairy: ['vegetable'],
    vegetable: ['vegetable', 'fat', 'israeli', 'nut_seed'],
    israeli: ['israeli', 'fat'],
  },
  snack: {
    dairy: ['fruit', 'nut_seed', 'cereal', 'grain', 'vegetable'],
    cheese: ['fruit', 'grain', 'vegetable'],
    fruit: ['nut_seed', 'cereal', 'grain', 'protein', 'sweet'],
    nut_seed: ['grain', 'sweet'],
    vegetable: ['israeli', 'protein', 'legume'],
    israeli: ['grain'],
    snack: ['fruit'],
  },
}

/** Roles that can carry an option (main meals additionally need protein — see `substantialAnchor`). */
const ANCHOR_ROLES: Readonly<Record<'main' | 'snack', readonly ComponentRole[]>> = {
  main: ['protein', 'dairy', 'cheese', 'legume', 'grain', 'cereal', 'israeli', 'dish', 'prepared', 'fast_food'],
  snack: ['dairy', 'cheese', 'fruit', 'nut_seed', 'snack', 'sweet', 'grain', 'cereal', 'protein', 'legume', 'israeli', 'prepared'],
}

/** Roles that can complete an option; drinks only at breakfast, cereals only at breakfast and snacks. */
const SIDE_ROLES: Readonly<Record<MealType, readonly ComponentRole[]>> = {
  breakfast: ['vegetable', 'fruit', 'grain', 'cereal', 'dairy', 'cheese', 'nut_seed', 'fat', 'israeli', 'beverage'],
  lunch: ['vegetable', 'fruit', 'grain', 'legume', 'dairy', 'cheese', 'nut_seed', 'fat', 'israeli'],
  dinner: ['vegetable', 'fruit', 'grain', 'legume', 'dairy', 'cheese', 'nut_seed', 'fat', 'israeli'],
  snack: ['fruit', 'vegetable', 'nut_seed', 'dairy', 'cheese', 'grain', 'cereal'],
}

const BREAKFAST_GRAIN_ROLES: readonly ComponentRole[] = ['grain', 'cereal']

function mealKind(mealType: MealType): MealKind {
  if (mealType === 'snack') return 'snack'
  return mealType === 'breakfast' ? 'breakfast' : 'main'
}

/** Culinary role of a food; null for uncategorized foods. */
export const componentRole = memoize((food: FoodItem): ComponentRole | null => {
  const { category } = food
  if (category === 'grain') {
    const listed = food.mealTypes
    return listed.length > 0 && listed.every((meal) => meal === 'breakfast' || meal === 'snack') ? 'cereal' : 'grain'
  }
  if (category === 'dairy') return (food.per100g.calories ?? 0) >= CHEESE_KCAL_PER_100G ? 'cheese' : 'dairy'
  if (DISH_CATEGORIES.includes(category) && proteinEnergyShare(food) >= MAIN_ANCHOR_PROTEIN_SHARE) return 'dish'
  return category
})

/** Breads, grains, cereals and wheat-based dishes (pita sandwiches, pizza, pastries): one per option. */
export const isStarchBase = memoize((food: FoodItem): boolean => {
  const role = componentRole(food)
  if (role !== null && BREAKFAST_GRAIN_ROLES.includes(role)) return true
  return (food.allergens ?? []).includes('wheat') && (food.per100g.carbs ?? 0) >= STARCH_BASE_CARBS_G
})

/** True when the two foods make sense together in one option for this meal. */
export function pairs(a: FoodItem, b: FoodItem, mealType: MealType): boolean {
  if (isStarchBase(a) && isStarchBase(b)) return false
  const roleA = componentRole(a)
  const roleB = componentRole(b)
  if (roleA === null || roleB === null) return true
  const table = PAIRS[mealKind(mealType)]
  return (table[roleA]?.includes(roleB) ?? false) || (table[roleB]?.includes(roleA) ?? false)
}

/**
 * Main-meal anchors must be substantial: at least 15 % of energy from protein, except breads and cereals at
 * breakfast. Snack anchors need no minimum. Uncategorized foods follow the same protein rule.
 */
export function substantialAnchor(food: FoodItem, mealType: MealType): boolean {
  const kind = mealKind(mealType)
  if (kind === 'snack') return true
  const role = componentRole(food)
  if (kind === 'breakfast' && role !== null && BREAKFAST_GRAIN_ROLES.includes(role)) return true
  return proteinEnergyShare(food) >= MAIN_ANCHOR_PROTEIN_SHARE
}

/** Foods that can carry an option: an anchor role (uncategorized foods qualify) that is substantial enough. */
export function canAnchor(food: FoodItem, mealType: MealType): boolean {
  const role = componentRole(food)
  const allowed = role === null || ANCHOR_ROLES[mealKind(mealType) === 'snack' ? 'snack' : 'main'].includes(role)
  return allowed && substantialAnchor(food, mealType)
}

/** Foods that can complete an option for this meal (complete dishes never do). */
export function canSide(food: FoodItem, mealType: MealType): boolean {
  const role = componentRole(food)
  return role === null || SIDE_ROLES[mealType].includes(role)
}
