import type {
  Favorite,
  FoodItem,
  FoodPortion,
  MealEntry,
  NutrientProfile,
  OutboxMutation,
  Profile,
  SavedMeal,
  ScheduledWorkout,
  WeightEntry,
  WorkoutEntry,
} from '@/types'
import { NUTRIENT_KEYS } from '@/types'

/**
 * Valid domain records for tests (schemas, local and Supabase repositories, sync).
 * Every factory returns a fresh object; pass overrides to vary fields.
 */
export const USER_A = '0b6f6c1e-8d3a-4f2b-9c1d-2e3f4a5b6c7d'
export const USER_B = '1c7a7d2f-9e4b-4a3c-8d2e-3f4a5b6c7d8e'
export const TS = '2026-10-03T08:15:00.000Z'

/** Deterministic v4-shaped UUID from a small number (for readable tests). */
export function testId(n: number): string {
  return `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`
}

export function makeNutrients(values: Partial<NutrientProfile> = {}): NutrientProfile {
  const base = Object.fromEntries(NUTRIENT_KEYS.map((key) => [key, null])) as NutrientProfile
  return { ...base, calories: 52, protein: 0.3, carbs: 14, fat: 0.2, fiber: 2.4, ...values }
}

export function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    userId: USER_A,
    displayName: 'Noa',
    birthDate: '1990-05-17',
    sex: 'female',
    heightCm: 165.5,
    currentWeightKg: 62.4,
    targetWeightKg: 60,
    activityLevel: 'moderate',
    goal: 'maintain',
    goalPace: 'gentle',
    dietType: 'mediterranean',
    allergies: ['peanuts'],
    dislikes: ['olives'],
    preferredCuisines: ['israeli', 'italian'],
    maxPrepMinutes: 30,
    cookingSkill: 'intermediate',
    strengthSessionsPerWeek: 2,
    cardioSessionsPerWeek: 3,
    preferredWorkoutMinutes: 45,
    unitSystem: 'metric',
    weekStartsOn: 0,
    reminders: { weighIn: true, activity: false },
    createdAt: TS,
    updatedAt: TS,
    ...overrides,
  }
}

export function makeFood(overrides: Partial<FoodItem> = {}): FoodItem {
  return {
    id: testId(100),
    source: 'custom',
    externalId: null,
    name: 'Grandma apple cake',
    brand: null,
    barcode: null,
    category: 'sweet',
    per100g: makeNutrients({ calories: 310, sodium: null }),
    servings: [{ label: '1 slice', grams: 85 }],
    allergens: null,
    dietFlags: { vegetarian: true, vegan: null },
    tags: ['quick'],
    mealTypes: ['snack'],
    prepMinutes: null,
    requiresCooking: true,
    costTier: 2,
    attribution: null,
    createdBy: USER_A,
    createdAt: TS,
    updatedAt: TS,
    ...overrides,
  }
}

export function makePortion(overrides: Partial<FoodPortion> = {}): FoodPortion {
  return {
    foodId: testId(100),
    foodSource: 'custom',
    foodExternalId: null,
    foodName: 'Apple',
    brand: null,
    quantity: 1.5,
    servingLabel: '1 medium',
    servingGrams: 182,
    grams: 273,
    per100g: makeNutrients(),
    ...overrides,
  }
}

export function makeMeal(overrides: Partial<MealEntry> = {}): MealEntry {
  return {
    ...makePortion(),
    id: testId(200),
    userId: USER_A,
    date: '2026-10-03',
    mealType: 'breakfast',
    loggedAt: TS,
    createdAt: TS,
    updatedAt: TS,
    ...overrides,
  }
}

export function makeSavedMeal(overrides: Partial<SavedMeal> = {}): SavedMeal {
  return {
    id: testId(300),
    userId: USER_A,
    name: 'Shakshuka plate',
    mealType: 'breakfast',
    items: [makePortion(), makePortion({ foodName: 'Pita', foodId: null, foodSource: 'system', servingLabel: null, servingGrams: null, quantity: 60, grams: 60 })],
    createdAt: TS,
    updatedAt: TS,
    ...overrides,
  }
}

export function makeFavorite(overrides: Partial<Favorite> = {}): Favorite {
  return { id: testId(400), userId: USER_A, foodId: testId(100), createdAt: TS, updatedAt: TS, ...overrides }
}

export function makeWeight(overrides: Partial<WeightEntry> = {}): WeightEntry {
  return {
    id: testId(500),
    userId: USER_A,
    date: '2026-10-03',
    measuredAt: '2026-10-03T05:30:00.000Z',
    weightKg: 72.35,
    inputUnit: 'kg',
    note: null,
    createdAt: TS,
    updatedAt: TS,
    ...overrides,
  }
}

export function makeWorkout(overrides: Partial<WorkoutEntry> = {}): WorkoutEntry {
  return {
    id: testId(600),
    userId: USER_A,
    date: '2026-10-03',
    type: 'run',
    durationMin: 35,
    intensity: 'moderate',
    estimatedKcal: 320,
    kcalSource: 'estimate',
    notes: null,
    scheduledWorkoutId: null,
    createdAt: TS,
    updatedAt: TS,
    ...overrides,
  }
}

export function makeScheduled(overrides: Partial<ScheduledWorkout> = {}): ScheduledWorkout {
  return {
    id: testId(700),
    userId: USER_A,
    date: '2026-10-05',
    type: 'strength',
    durationMin: 40,
    intensity: null,
    status: 'planned',
    source: 'catch_up',
    rationale: 'Two strength sessions remain this week',
    completedWorkoutId: null,
    createdAt: TS,
    updatedAt: TS,
    ...overrides,
  }
}

export function makeOutbox(overrides: Partial<OutboxMutation> = {}): OutboxMutation {
  return {
    id: testId(800),
    userId: USER_A,
    entity: 'meal_logs',
    op: 'upsert',
    recordId: testId(200),
    payload: makeMeal(),
    createdAt: TS,
    attempts: 0,
    status: 'pending',
    lastError: null,
    nextAttemptAt: null,
    ...overrides,
  }
}
