import type { Allergen, FoodItem, MealType } from '@/types'
import { isKnownAmount } from '../nutrition'
import { BEGINNER_MAX_PREP_MINUTES, OCCASIONAL_RULES } from './constants'
import { dietRule } from './diets'
import { containsPhrase, resolvePreferences, type AdaptivePreferences } from './preferences'
import { EXCLUSION_REASONS, type CandidateResult, type ExclusionReason } from './types'

export interface CandidateOptions {
  /** null before onboarding → app defaults (see `resolvePreferences`). */
  profile: AdaptivePreferences | null
  /** Meal slot the foods must suit; null = any slot. */
  mealType: MealType | null
  /** Favorited foods stay eligible even when they are occasional foods. */
  favoriteFoodIds?: readonly string[]
}

const CORE_NUTRIENTS = ['protein', 'carbs', 'fat'] as const

/** Allergens that also exclude a food: a gluten allergy covers wheat. */
const IMPLIED_ALLERGENS: Readonly<Partial<Record<Allergen, readonly Allergen[]>>> = { gluten: ['wheat'] }

function avoidedAllergens(allergies: readonly Allergen[]): Set<Allergen> {
  const avoided = new Set<Allergen>()
  for (const allergy of allergies) {
    avoided.add(allergy)
    for (const implied of IMPLIED_ALLERGENS[allergy] ?? []) avoided.add(implied)
  }
  return avoided
}

/**
 * Preparation minutes used for planning: the stated minutes, 0 for an unknown time on a food that needs no
 * cooking, and null (unknown) for an unknown time on a food that may need cooking.
 */
export function effectivePrepMinutes(food: Pick<FoodItem, 'prepMinutes' | 'requiresCooking'>): number | null {
  if (food.prepMinutes !== null && Number.isFinite(food.prepMinutes)) return Math.max(0, food.prepMinutes)
  return food.requiresCooking === false ? 0 : null
}

function searchableText(food: FoodItem): string {
  return [food.name, food.category ?? '', ...food.tags].join(' ')
}

interface Rules {
  prefs: AdaptivePreferences
  avoided: Set<Allergen>
  mealType: MealType | null
  favorites: ReadonlySet<string>
}

/** Fast food, sweets, sugary drinks and fatty low-fiber snacks (see OCCASIONAL_RULES). */
export function isOccasionalFood(food: Pick<FoodItem, 'category' | 'per100g'>): boolean {
  const { category, per100g } = food
  if (category === null) return false
  if ((OCCASIONAL_RULES.categories as readonly string[]).includes(category)) return true
  if (category === 'beverage') return (per100g.sugars ?? 0) >= OCCASIONAL_RULES.beverageSugarsG
  if (category === 'snack') {
    return (per100g.fat ?? 0) >= OCCASIONAL_RULES.snackFatG && (per100g.fiber ?? 0) < OCCASIONAL_RULES.snackFiberG
  }
  return false
}

function exclusionReason(food: FoodItem, { prefs, avoided, mealType, favorites }: Rules): ExclusionReason | null {
  const { calories } = food.per100g
  if (!isKnownAmount(calories) || !CORE_NUTRIENTS.every((key) => isKnownAmount(food.per100g[key]))) return 'incomplete_nutrition'
  if (calories <= 0) return 'no_energy'
  if (isOccasionalFood(food) && !favorites.has(food.id)) return 'occasional'
  if (avoided.size > 0) {
    if (food.allergens === null) return 'allergen_unknown'
    if (food.allergens.some((allergen) => avoided.has(allergen))) return 'allergen'
  }
  if (!dietRule(prefs.dietType).isCompatible(food)) return 'diet'
  if (prefs.dislikes.length > 0) {
    const text = searchableText(food)
    if (prefs.dislikes.some((dislike) => containsPhrase(text, dislike))) return 'dislike'
  }
  if (mealType !== null && food.mealTypes.length > 0 && !food.mealTypes.includes(mealType)) return 'meal_type'
  const prep = effectivePrepMinutes(food)
  if (prep === null || prep > prefs.maxPrepMinutes) return 'prep_time'
  if (prefs.cookingSkill === 'beginner' && prep > BEGINNER_MAX_PREP_MINUTES) return 'cooking_skill'
  return null
}

export function emptyExclusions(): Record<ExclusionReason, number> {
  return Object.fromEntries(EXCLUSION_REASONS.map((reason) => [reason, 0])) as Record<ExclusionReason, number>
}

/**
 * Recommendation Candidate Engine: the foods that may appear in suggestions, in input order.
 * Rules, in order (an excluded food counts once, under the first rule it fails):
 * 1. calories, protein, carbohydrate and fat must be known; energy must be above 0;
 *    occasional foods (fast food, sweets, sugary drinks, chips) are only suggested when favorited;
 * 2. allergies: with any allergy set, unknown allergen information excludes the food; any overlap excludes it
 *    (a gluten allergy also excludes wheat);
 * 3. diet: vegetarian/vegan need the flag to be explicitly true;
 * 4. dislikes: case-insensitive whole-word match on name, category and tags;
 * 5. meal slot: the food lists the slot, or lists none (= any slot);
 * 6. preparation within `maxPrepMinutes` (an unknown time passes only for foods that need no cooking);
 *    beginner cooks: at most 20 minutes.
 */
export function filterCandidates(foods: readonly FoodItem[], options: CandidateOptions): CandidateResult {
  const prefs = resolvePreferences(options.profile)
  const rules: Rules = {
    prefs,
    avoided: avoidedAllergens(prefs.allergies),
    mealType: options.mealType,
    favorites: new Set(options.favoriteFoodIds ?? []),
  }
  const excluded = emptyExclusions()
  const candidates: FoodItem[] = []
  const seen = new Set<string>()
  for (const food of foods) {
    if (seen.has(food.id)) continue
    seen.add(food.id)
    const reason = exclusionReason(food, rules)
    if (reason === null) candidates.push(food)
    else excluded[reason] += 1
  }
  return { candidates, excluded }
}
