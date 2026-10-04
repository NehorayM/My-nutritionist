import { describe, expect, it } from 'vitest'
import { SYSTEM_FOOD_RECORDS } from '@/data/catalog'
import { FOOD_CATEGORIES, MEAL_TYPES, type FoodCategory } from '@/types'

function inCategory(category: FoodCategory): string[] {
  return SYSTEM_FOOD_RECORDS.filter((food) => food.category === category).map((food) => food.slug)
}

/** Required coverage groups: minimum size of the category plus everyday foods that must be findable. */
const COVERAGE: ReadonlyArray<{ group: string; category: FoodCategory; min: number; mustInclude: string[] }> = [
  {
    group: 'Israeli staples',
    category: 'israeli',
    min: 5,
    mustInclude: ['hummus', 'falafel', 'shakshuka', 'israeli_salad', 'burekas_cheese', 'shawarma_in_pita'],
  },
  { group: 'fast food', category: 'fast_food', min: 3, mustInclude: ['cheese_pizza', 'hamburger_fast_food', 'french_fries_fast_food'] },
  { group: 'snacks', category: 'snack', min: 3, mustInclude: ['potato_chips', 'popcorn_air_popped', 'protein_bar'] },
  { group: 'fruits', category: 'fruit', min: 6, mustInclude: ['apple', 'banana', 'orange', 'medjool_dates'] },
  { group: 'vegetables', category: 'vegetable', min: 8, mustInclude: ['tomato', 'cucumber', 'red_bell_pepper', 'onion_raw'] },
  { group: 'legumes', category: 'legume', min: 3, mustInclude: ['lentils_cooked', 'chickpeas_cooked'] },
  { group: 'dairy', category: 'dairy', min: 5, mustInclude: ['cottage_cheese', 'greek_yogurt_plain', 'milk_2_percent', 'feta_cheese'] },
  { group: 'grains', category: 'grain', min: 8, mustInclude: ['pita_white', 'white_rice_cooked', 'rolled_oats', 'whole_wheat_bread'] },
  { group: 'proteins', category: 'protein', min: 6, mustInclude: ['chicken_breast_roasted', 'egg_hard_boiled', 'tuna_canned_in_water', 'tofu_firm'] },
]

describe('system food catalog — coverage', () => {
  it.each(COVERAGE)('covers $group', ({ category, min, mustInclude }) => {
    const members = inCategory(category)
    expect(members.length).toBeGreaterThanOrEqual(min)
    expect(members).toEqual(expect.arrayContaining(mustInclude))
  })

  it('includes the Israeli pantry basics used by the israeli tag', () => {
    const israeliTagged = SYSTEM_FOOD_RECORDS.filter((food) => food.tags.includes('israeli')).map((food) => food.slug)
    expect(israeliTagged).toEqual(expect.arrayContaining(['pita_white', 'tahini', 'cottage_cheese', 'hummus']))
  })

  it('offers options for every meal slot and for vegan, vegetarian and allergy-aware plans', () => {
    const thinSlots = MEAL_TYPES.filter(
      (meal) => SYSTEM_FOOD_RECORDS.filter((food) => food.mealTypes.includes(meal)).length < 15,
    )
    expect(thinSlots).toEqual([])
    const veganProtein = SYSTEM_FOOD_RECORDS.filter(
      (food) => food.dietFlags.vegan === true && food.tags.includes('high_protein'),
    )
    expect(veganProtein.length).toBeGreaterThanOrEqual(4)
    const allergenFree = SYSTEM_FOOD_RECORDS.filter((food) => food.allergens !== null && food.allergens.length === 0)
    expect(allergenFree.length).toBeGreaterThanOrEqual(30)
  })

  it('covers at least one food in every category except the generic "prepared" bucket', () => {
    const used = new Set(SYSTEM_FOOD_RECORDS.map((food) => food.category))
    const missing = FOOD_CATEGORIES.filter((category) => category !== 'prepared' && !used.has(category))
    expect(missing).toEqual([])
  })
})
