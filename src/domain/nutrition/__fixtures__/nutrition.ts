import type { MealEntry, MealType, NutrientProfile } from '@/types'
import { nutrientProfile } from '../../nutrients'
import type { DailyTargets, NutrientTarget, TargetProfile } from '../types'

export const TODAY = '2026-10-04'

/** Adult woman, 30 on TODAY: 165 cm, 70 kg, lightly active, maintain, balanced. */
export function adultProfile(overrides: Partial<TargetProfile> = {}): TargetProfile {
  return {
    birthDate: '1996-05-10',
    sex: 'female',
    heightCm: 165,
    currentWeightKg: 70,
    targetWeightKg: null,
    activityLevel: 'light',
    goal: 'maintain',
    goalPace: 'gentle',
    dietType: 'balanced',
    ...overrides,
  }
}

/** Per-100 g values from the bundled seed (USDA FoodData Central). */
export const CHEESE_PIZZA = nutrientProfile({
  calories: 266,
  protein: 11.4,
  carbs: 33.3,
  fat: 9.7,
  fiber: 2.3,
  sugars: 3.6,
  saturatedFat: 4.5,
  sodium: 540,
  iron: 2.5,
  calcium: 188,
  vitaminC: 1.4,
  vitaminD: 0,
  potassium: 172,
})

export const COLA = nutrientProfile({
  calories: 42,
  protein: 0,
  carbs: 10.4,
  fat: 0.3,
  fiber: 0,
  sugars: 9.9,
  saturatedFat: 0,
  sodium: 3,
  iron: 0,
  calcium: 1,
  vitaminC: 0,
  vitaminD: 0,
  potassium: 5,
})

/** Banana, raw (USDA SR Legacy 173944), with vitamin D unknown. */
export const BANANA = nutrientProfile({
  calories: 89,
  protein: 1.09,
  carbs: 22.84,
  fat: 0.33,
  fiber: 2.6,
  sugars: 12.23,
  saturatedFat: 0.112,
  sodium: 1,
  potassium: 358,
  calcium: 5,
  iron: 0.26,
  vitaminC: 8.7,
  vitaminD: null,
})

let sequence = 0

export function mealEntry(
  mealType: MealType,
  per100g: NutrientProfile,
  grams: number,
  date: string = TODAY,
): MealEntry {
  sequence += 1
  return {
    id: `entry-${sequence}`,
    userId: 'user-1',
    date,
    mealType,
    loggedAt: `${date}T12:00:00.000Z`,
    createdAt: `${date}T12:00:00.000Z`,
    updatedAt: `${date}T12:00:00.000Z`,
    foodId: null,
    foodSource: 'system',
    foodExternalId: null,
    foodName: 'Test food',
    brand: null,
    quantity: grams,
    servingLabel: null,
    servingGrams: null,
    grams,
    per100g,
  }
}

export function target(kind: NutrientTarget['kind'], amount: number, min: number | null, max: number | null): NutrientTarget {
  return { amount, min, max, kind }
}

export function dailyTargets(targets: DailyTargets['targets']): DailyTargets {
  return {
    mode: 'personalized',
    estimate: { method: 'mifflin_st_jeor', bmrKcal: 1400, maintenanceKcal: 2000, goalAdjustmentKcal: 0 },
    targets,
    assumptions: [],
  }
}

/** Local time on TODAY (or another date key). */
export function localTime(hours: number, minutes = 0, date: string = TODAY): Date {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  return new Date(y, m - 1, d, hours, minutes)
}
