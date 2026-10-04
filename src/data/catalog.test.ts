import { describe, expect, it } from 'vitest'
import { SYSTEM_FOOD_CATALOG, SYSTEM_FOOD_RECORDS, SYSTEM_FOODS_RELEASED_AT } from '@/data/catalog'
import type { SystemFoodRecord } from '@/data/catalogSchema'
import { systemFoodId } from '@/lib/id'
import { ALLERGENS, FOOD_CATEGORIES, FOOD_TAGS, MEAL_TYPES, NUTRIENT_KEYS } from '@/types'

const foods = SYSTEM_FOOD_RECORDS
const GRAM_KEYS = ['protein', 'carbs', 'fat', 'fiber', 'sugars', 'saturatedFat'] as const

function grams(value: number | null): number {
  return value ?? 0
}

/** Slugs (optionally with a detail) of the foods failing a predicate — failures list every offender at once. */
function offenders(fails: (food: SystemFoodRecord) => boolean | string[]): string[] {
  return foods.flatMap((food) => {
    const result = fails(food)
    if (Array.isArray(result)) return result.map((detail) => `${food.slug}: ${detail}`)
    return result ? [food.slug] : []
  })
}

function outside(values: readonly string[], allowed: readonly string[]): string[] {
  return values.filter((value) => !allowed.includes(value))
}

function inCanonicalOrder(values: readonly string[], order: readonly string[]): boolean {
  const positions = values.map((value) => order.indexOf(value))
  return positions.every((position, index) => index === 0 || (positions[index - 1] ?? -1) < position)
}

describe('system food catalog — identity', () => {
  it('ships at least 60 foods', () => {
    expect(foods.length).toBeGreaterThanOrEqual(60)
  })

  it('has unique slugs and unique ids', () => {
    expect(new Set(foods.map((food) => food.slug)).size).toBe(foods.length)
    expect(new Set(foods.map((food) => food.id)).size).toBe(foods.length)
  })

  it('derives every id from its slug with systemFoodId (shared with the database seed)', async () => {
    const expected = await Promise.all(foods.map((food) => systemFoodId(food.slug)))
    expect(foods.map((food) => food.id)).toEqual(expected)
  })

  it('stamps a release instant that is not in the future', () => {
    expect(SYSTEM_FOODS_RELEASED_AT).toBe(SYSTEM_FOOD_CATALOG.meta.releasedAt)
    expect(Date.parse(SYSTEM_FOODS_RELEASED_AT)).toBeLessThanOrEqual(Date.now())
  })
})

describe('system food catalog — nutrients per 100 g', () => {
  it('has every nutrient key, each null (unknown) or a finite non-negative number', () => {
    expect(offenders((food) => Object.keys(food.per100g).sort().join() !== [...NUTRIENT_KEYS].sort().join())).toEqual([])
    const invalid = offenders((food) =>
      NUTRIENT_KEYS.filter((key) => {
        const value = food.per100g[key]
        return value !== null && !(Number.isFinite(value) && value >= 0)
      }),
    )
    expect(invalid).toEqual([])
  })

  it('always knows energy and the three energy macros', () => {
    const keys = ['calories', 'protein', 'carbs', 'fat'] as const
    expect(offenders((food) => keys.filter((key) => food.per100g[key] === null))).toEqual([])
  })

  it('stays within physical limits: ≤ 900 kcal and ≤ 100 g of any macro per 100 g', () => {
    expect(offenders((food) => grams(food.per100g.calories) > 900)).toEqual([])
    expect(offenders((food) => GRAM_KEYS.filter((key) => grams(food.per100g[key]) > 100))).toEqual([])
    const overfull = offenders((food) => {
      const { protein, carbs, fat } = food.per100g
      return grams(protein) + grams(carbs) + grams(fat) > 100.5
    })
    expect(overfull).toEqual([])
  })

  it('keeps sub-components within their parent (fiber ≤ carbs, saturated ≤ total fat)', () => {
    expect(offenders((food) => grams(food.per100g.fiber) > grams(food.per100g.carbs))).toEqual([])
    expect(offenders((food) => grams(food.per100g.saturatedFat) > grams(food.per100g.fat))).toEqual([])
  })

  it('records USDA-unreported values as null instead of zero', () => {
    const falafel = foods.find((food) => food.slug === 'falafel')
    expect(falafel?.per100g.fiber).toBeNull()
    expect(falafel?.per100g.sugars).toBeNull()
    expect(foods.find((food) => food.slug === 'medjool_dates')?.per100g.saturatedFat).toBeNull()
  })
})

describe('system food catalog — servings', () => {
  it('offers at least one serving per food, with positive grams and unique labels', () => {
    expect(offenders((food) => food.servings.length === 0)).toEqual([])
    expect(offenders((food) => food.servings.filter((s) => !(s.grams > 0)).map((s) => s.label))).toEqual([])
    expect(offenders((food) => new Set(food.servings.map((s) => s.label)).size !== food.servings.length)).toEqual([])
  })

  it('shows the serving weight in every label, matching its grams', () => {
    const mismatched = offenders((food) =>
      food.servings.filter((serving) => !serving.label.endsWith(`(${serving.grams} g)`)).map((s) => s.label),
    )
    expect(mismatched).toEqual([])
  })
})

describe('system food catalog — classification', () => {
  it('uses only known categories, tags, allergens and meal types', () => {
    expect(offenders((food) => outside([food.category], FOOD_CATEGORIES))).toEqual([])
    expect(offenders((food) => outside(food.tags, FOOD_TAGS))).toEqual([])
    expect(offenders((food) => outside(food.allergens ?? [], ALLERGENS))).toEqual([])
    expect(offenders((food) => outside(food.mealTypes, MEAL_TYPES))).toEqual([])
    expect(offenders((food) => food.mealTypes.length === 0)).toEqual([])
  })

  it('lists tags, allergens and meal types in canonical order (stable diffs and SQL)', () => {
    expect(offenders((food) => !inCanonicalOrder(food.tags, FOOD_TAGS))).toEqual([])
    expect(offenders((food) => !inCanonicalOrder(food.allergens ?? [], ALLERGENS))).toEqual([])
    expect(offenders((food) => !inCanonicalOrder(food.mealTypes, MEAL_TYPES))).toEqual([])
  })

  it('keeps diet flags consistent with allergens', () => {
    const animal = ['milk', 'egg', 'fish', 'shellfish']
    const seafood = ['fish', 'shellfish']
    const allergensOf = (food: SystemFoodRecord): string[] => food.allergens ?? []
    expect(offenders((food) => food.dietFlags.vegan === true && food.dietFlags.vegetarian !== true)).toEqual([])
    const veganWithAnimal = offenders((food) =>
      food.dietFlags.vegan === true ? allergensOf(food).filter((allergen) => animal.includes(allergen)) : [],
    )
    expect(veganWithAnimal).toEqual([])
    const vegetarianWithSeafood = offenders((food) =>
      food.dietFlags.vegetarian === true ? allergensOf(food).filter((allergen) => seafood.includes(allergen)) : [],
    )
    expect(vegetarianWithSeafood).toEqual([])
    const wheatWithoutGluten = offenders(
      (food) => allergensOf(food).includes('wheat') && !allergensOf(food).includes('gluten'),
    )
    expect(wheatWithoutGluten).toEqual([])
  })

  it('derives rule-based tags exactly as documented in meta.tagRules', () => {
    const mismatched = offenders((food) => {
      const derived = food.tags.filter((tag) => tag !== 'mediterranean' && tag !== 'israeli').sort()
      const expected = expectedRuleTags(food).sort()
      return derived.join() === expected.join() ? [] : [`has [${derived.join()}], rules give [${expected.join()}]`]
    })
    expect(mismatched).toEqual([])
  })

  it('explains every non-exact USDA match in a note', () => {
    expect(offenders((food) => food.usda.match !== 'exact' && (food.usda.note?.length ?? 0) < 20)).toEqual([])
  })

  it('uses neutral, supportive wording in names and notes', () => {
    const judgmental = /\b(bad|junk|cheat|guilt\w*|sinful|naughty|unhealthy|failure|burn off|earn)\b/i
    expect(offenders((food) => judgmental.test(`${food.name} ${food.usda.note ?? ''}`))).toEqual([])
  })
})

function expectedRuleTags(food: SystemFoodRecord): string[] {
  const tags: string[] = []
  if (food.dietFlags.vegetarian === true) tags.push('vegetarian')
  if (food.dietFlags.vegan === true) tags.push('vegan')
  const takeout = food.category === 'fast_food' || food.slug === 'shawarma_in_pita'
  if (takeout) return tags
  const { calories, protein, fiber } = food.per100g
  if (grams(protein) >= 8 && grams(protein) * 4 >= 0.2 * grams(calories)) tags.push('high_protein')
  if (grams(fiber) >= 6 && food.category !== 'sweet') tags.push('high_fiber')
  if (food.requiresCooking === false) tags.push('no_cook')
  if (food.prepMinutes !== null && food.prepMinutes <= 10) tags.push('quick')
  if (food.costTier === 1 && !['snack', 'sweet', 'beverage'].includes(food.category)) tags.push('budget')
  return tags
}
