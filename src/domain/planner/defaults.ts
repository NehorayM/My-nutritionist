import type { FoodItem, KitchenEquipment, MealConstraint, MealType, PantryPrep, PlannerSettings } from '@/types'

const ALL_EQUIPMENT: KitchenEquipment[] = ['microwave', 'stove', 'oven']

const meal = (maxMinutes: number, canCook = true): MealConstraint => ({
  enabled: true,
  equipment: [...ALL_EQUIPMENT],
  canCook,
  maxMinutes,
  kcalMin: null,
  kcalMax: null,
})

/** A full kitchen all day; quick breakfasts and snacks, more time for dinner; calorie ranges from the targets. */
export function createDefaultPlannerSettings(userId: string, nowIso: string): PlannerSettings {
  const meals: Record<MealType, MealConstraint> = {
    breakfast: meal(15),
    lunch: meal(20),
    dinner: meal(45),
    snack: meal(5, false),
  }
  return {
    userId,
    equipmentScope: 'day',
    dayEquipment: [...ALL_EQUIPMENT],
    dailyKcalMin: null,
    dailyKcalMax: null,
    meals,
    createdAt: nowIso,
    updatedAt: nowIso,
  }
}

export interface PrepDefaults {
  prep: PantryPrep
  cookMinutes: number | null
  methods: KitchenEquipment[]
}

const COOKED_WORDS = /\b(cooked|baked|roasted|grilled|boiled|broiled|steamed|fried|stewed)\b/i
const RAW_WORDS = /\b(raw|uncooked|dry|dried)\b/i
const RAW_STAPLES = new Set(['protein', 'grain', 'legume'])

const cook = (food: FoodItem): PrepDefaults => ({
  prep: 'cook',
  cookMinutes: Math.min(600, Math.max(1, food.prepMinutes ?? 20)),
  methods: food.category === 'grain' || food.category === 'legume' ? ['stove'] : ['stove', 'oven'],
})

/**
 * How a newly added pantry item is probably eaten (the user can change it):
 * - foods that need cooking (catalog flag, or "raw/dry" staples) → cook from raw, with the food's prep time;
 * - foods described as cooked/baked/roasted… → leftovers to warm up;
 * - everything else → ready to eat.
 */
export function defaultPrepFor(food: FoodItem): PrepDefaults {
  if (food.requiresCooking === true) return cook(food)
  if (food.requiresCooking === null) {
    if (COOKED_WORDS.test(food.name)) return { prep: 'reheat', cookMinutes: null, methods: ['microwave', 'stove'] }
    if (food.category !== null && RAW_STAPLES.has(food.category) && RAW_WORDS.test(food.name)) return cook(food)
  }
  return { prep: 'ready', cookMinutes: null, methods: [] }
}
