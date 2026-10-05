import { SYSTEM_FOODS, systemFoodBySlug } from '@/data/systemFoods'
import type { FoodItem, MealEntry, MealType, NutrientProfile, Profile } from '@/types'
import { nutrientProfile } from '../../nutrients'
import { calculateDailyTargets, type DailyTargets } from '../../nutrition'
import { createDefaultProfile } from '../../profile'
import type { AdaptiveInput, AdaptivePlan } from '../types'

export const TODAY = '2026-10-04'
const INSTANT = '2026-10-01T08:00:00.000Z'

/** Words the product never uses about food or eating. */
export const FORBIDDEN_COPY = /\b(bad food|cheat\w*|fail\w*|burn(ed|s)? off|earn\w*|guilt\w*|compensat\w*|junk|punish\w*|unhealthy|should|must)\b/i

/** Adult woman, 30 on TODAY: 165 cm, 70 kg, lightly active, maintain, balanced, no restrictions. */
export function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    ...createDefaultProfile('user-1', INSTANT),
    birthDate: '1996-05-10',
    sex: 'female',
    heightCm: 165,
    currentWeightKg: 70,
    goal: 'maintain',
    maxPrepMinutes: 45,
    ...overrides,
  }
}

export function targetsFor(person: Profile | null): DailyTargets {
  return calculateDailyTargets({ profile: person, date: TODAY })
}

/** Local time on TODAY (or another date key). */
export function localTime(hours: number, minutes = 0, date: string = TODAY): Date {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  return new Date(y, m - 1, d, hours, minutes)
}

let foodSequence = 0

/** A complete, unrestricted test food; per-100 g values default to a modest mixed dish. */
export function food(overrides: Partial<Omit<FoodItem, 'per100g'>> & { per100g?: Partial<NutrientProfile> } = {}): FoodItem {
  foodSequence += 1
  const { per100g, ...rest } = overrides
  return {
    id: `food-${foodSequence}`,
    source: 'custom',
    externalId: null,
    name: `Test food ${foodSequence}`,
    brand: null,
    barcode: null,
    category: 'prepared',
    per100g: nutrientProfile({
      calories: 150,
      protein: 10,
      carbs: 15,
      fat: 5,
      fiber: 3,
      sugars: 2,
      saturatedFat: 1,
      sodium: 200,
      potassium: 300,
      calcium: 50,
      iron: 1.5,
      vitaminC: 5,
      vitaminD: 0.5,
      ...per100g,
    }),
    servings: [],
    allergens: [],
    dietFlags: { vegetarian: true, vegan: true },
    tags: [],
    mealTypes: [],
    prepMinutes: 5,
    requiresCooking: false,
    costTier: 1,
    attribution: null,
    createdBy: 'user-1',
    createdAt: INSTANT,
    updatedAt: INSTANT,
    ...rest,
  }
}

export function systemFood(slug: string): FoodItem {
  const found = systemFoodBySlug(slug)
  if (!found) throw new Error(`Unknown system food ${slug}`)
  return found
}

let entrySequence = 0

/** A meal entry of `grams` of a food on TODAY (or `date`). */
export function entry(item: FoodItem, grams: number, mealType: MealType, date: string = TODAY): MealEntry {
  entrySequence += 1
  return {
    id: `entry-${entrySequence}`,
    userId: 'user-1',
    date,
    mealType,
    loggedAt: `${date}T12:00:00.000Z`,
    createdAt: `${date}T12:00:00.000Z`,
    updatedAt: `${date}T12:00:00.000Z`,
    foodId: item.id,
    foodSource: item.source,
    foodExternalId: item.externalId,
    foodName: item.name,
    brand: item.brand,
    quantity: grams,
    servingLabel: null,
    servingGrams: null,
    grams,
    per100g: item.per100g,
  }
}

/** Input for the system catalog with an adult profile at 12:30 on TODAY; override anything. */
export function planInput(overrides: Partial<AdaptiveInput> = {}): AdaptiveInput {
  const person = overrides.profile === undefined ? profile() : overrides.profile
  return {
    profile: person,
    targets: targetsFor(person),
    entries: [],
    now: localTime(12, 30),
    date: TODAY,
    foods: [...SYSTEM_FOODS],
    favoriteFoodIds: [],
    recentFoodIds: [],
    dismissedIds: [],
    ...overrides,
  }
}

/** Every user-facing sentence of a plan. */
export function planCopy(plan: AdaptivePlan): string[] {
  return [plan.message, ...plan.recommendations.flatMap((rec) => [rec.explanation, rec.title])]
}

/** Foods of every recommendation in a plan. */
export function recommendedFoods(plan: AdaptivePlan): FoodItem[] {
  return plan.recommendations.flatMap((rec) => rec.items.map((item) => item.food))
}
