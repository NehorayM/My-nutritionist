import { unknownNutrients } from '@/domain/nutrients'
import type { FoodItem } from '@/types'

const TIMESTAMP = '2026-10-01T00:00:00.000Z'

/** Builds a FoodItem for tests; ids are readable but unique per name unless overridden. */
export function testFood(name: string, overrides: Partial<FoodItem> = {}): FoodItem {
  return {
    id: `food-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    source: 'system',
    externalId: name.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
    name,
    brand: null,
    barcode: null,
    category: null,
    per100g: { ...unknownNutrients(), calories: 100, protein: 5, carbs: 10, fat: 3 },
    servings: [],
    allergens: [],
    dietFlags: { vegetarian: null, vegan: null },
    tags: [],
    mealTypes: [],
    prepMinutes: null,
    requiresCooking: null,
    costTier: null,
    attribution: null,
    createdBy: null,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    ...overrides,
  }
}

/** A small catalog with names from the bundled seed. */
export const TEST_CATALOG: readonly FoodItem[] = [
  testFood('Chicken breast, roasted (skinless)'),
  testFood('Chicken thigh, roasted (skinless)'),
  testFood('Chickpeas, cooked'),
  testFood('Cheddar cheese'),
  testFood('Cottage cheese (about 4% fat)'),
  testFood('Greek yogurt, plain, low-fat'),
  testFood('Hummus'),
  testFood('Falafel'),
  testFood('Shawarma in pita'),
  testFood('Pita bread'),
  testFood('Cheese burekas'),
  testFood('Strawberries'),
  testFood('Blueberries'),
  testFood('Tomato'),
  testFood('Tahini (sesame paste)'),
  testFood('Crème fraîche'),
]
