import { describe, expect, it } from 'vitest'
import { food, systemFood } from './__fixtures__/adaptive'
import { PORTION_GRAMS, SIDE_ENERGY_SHARE, portionRange, sideShare } from './portionRanges'
import { portionOption, roundPortion } from './portions'

const chicken = systemFood('chicken_breast_roasted')
const rice = systemFood('brown_rice_cooked')
const broccoli = systemFood('broccoli_cooked')

function kcal(items: ReturnType<typeof portionOption>): number {
  return items.reduce((sum, item) => sum + (item.nutrients.calories ?? 0), 0)
}

describe('portionRange', () => {
  it('uses the category range, capped at 2.5 × the largest household serving', () => {
    expect(portionRange(food({ category: 'protein', servings: [] }))).toEqual(PORTION_GRAMS.protein)
    expect(portionRange(food({ category: 'protein', servings: [{ label: '1 piece', grams: 30 }] }))).toEqual({ min: 50, max: 100 })
    expect(portionRange(food({ category: 'protein', servings: [{ label: 'broken', grams: 0 }] }))).toEqual(PORTION_GRAMS.protein)
  })

  it('caps energy-dense foods within their category', () => {
    expect(portionRange(food({ category: 'dairy', per100g: { calories: 460 } })).max).toBe(40)
    expect(portionRange(food({ category: 'dairy', per100g: { calories: 300 } })).max).toBe(60)
    expect(portionRange(food({ category: 'grain', per100g: { calories: 380 } })).max).toBe(80)
    expect(portionRange(food({ category: 'israeli', per100g: { calories: 240 } })).max).toBe(150)
    expect(portionRange(food({ category: 'protein', per100g: { calories: 500 } }))).toEqual({ min: 40, max: 40 })
  })

  it('uses a generic range for uncategorized foods', () => {
    expect(portionRange(food({ category: null }))).toEqual({ min: 20, max: 300 })
  })

  it('applies no energy cap when energy is unknown', () => {
    expect(portionRange(food({ category: 'dairy', per100g: { calories: null } }))).toEqual(PORTION_GRAMS.dairy)
  })
})

describe('sideShare', () => {
  it('uses the category share of the meal energy, 20 % for uncategorized foods', () => {
    expect(sideShare(food({ category: 'vegetable' }))).toBe(SIDE_ENERGY_SHARE.vegetable)
    expect(sideShare(food({ category: 'grain' }))).toBe(0.3)
    expect(sideShare(food({ category: null }))).toBe(0.2)
  })
})

describe('roundPortion', () => {
  it('uses whole household units when one lands within ±15 %', () => {
    expect(roundPortion(chicken, 170)).toEqual({ grams: 172, quantity: 2, servingLabel: '1/2 breast (86 g)', servingGrams: 86 })
    expect(roundPortion(chicken, 140)).toMatchObject({ grams: 140, quantity: 1, servingGrams: 140 })
  })

  it('rounds to 5 g otherwise, within the realistic range', () => {
    const plain = food({ category: 'protein', servings: [] })
    expect(roundPortion(plain, 123)).toEqual({ grams: 125, quantity: 125, servingLabel: null, servingGrams: null })
    expect(roundPortion(plain, 900).grams).toBe(200)
    expect(roundPortion(plain, 3).grams).toBe(50)
  })

  it('skips servings that would need more than four units or none at all', () => {
    const slices = food({ category: 'grain', servings: [{ label: '1 slice', grams: 20 }, { label: '1 loaf', grams: 400 }] })
    expect(roundPortion(slices, 100)).toMatchObject({ grams: 100, servingLabel: null })
    expect(roundPortion(slices, 60)).toMatchObject({ grams: 60, quantity: 3, servingLabel: '1 slice' })
  })

  it('ignores household servings with an unusable size', () => {
    const odd = food({ category: 'grain', servings: [{ label: 'broken', grams: 0 }, { label: 'NaN', grams: Number.NaN }, { label: '1 cup', grams: 50 }] })
    expect(roundPortion(odd, 100)).toMatchObject({ grams: 100, quantity: 2, servingLabel: '1 cup' })
  })

  it('can be limited to 5 g steps', () => {
    expect(roundPortion(chicken, 170, false)).toEqual({ grams: 170, quantity: 170, servingLabel: null, servingGrams: null })
  })

  it('never goes below 5 g', () => {
    const oil = food({ category: 'fat', per100g: { calories: 884 } })
    expect(roundPortion(oil, 1).grams).toBe(5)
  })
})

describe('portionOption', () => {
  it('returns nothing for no foods', () => {
    expect(portionOption([], 600)).toEqual([])
  })

  it('sizes an anchor alone to the energy target within its range', () => {
    const [only] = portionOption([rice], 200)
    expect(only?.grams).toBe(165)
    expect(only?.nutrients.calories).toBeCloseTo((only!.grams * 123) / 100)
    expect(portionOption([chicken], 2000)[0]?.grams).toBeLessThanOrEqual(200)
  })

  it('gives sides their category share and the anchor the rest, within ±15 % of the target', () => {
    const items = portionOption([chicken, rice, broccoli], 650)
    expect(items.map((item) => item.food.id)).toEqual([chicken.id, rice.id, broccoli.id])
    expect(Math.abs(kcal(items) - 650)).toBeLessThanOrEqual(0.15 * 650)
    expect(items[2]!.nutrients.calories!).toBeLessThan(items[0]!.nutrients.calories!)
  })

  it('grows the sides when the anchor reaches its limit', () => {
    const eggWhite = food({ category: 'protein', servings: [], per100g: { calories: 52, protein: 11, carbs: 1, fat: 0.2 } })
    const items = portionOption([eggWhite, rice, broccoli], 400)
    expect(items[0]!.grams).toBe(200)
    expect(Math.abs(kcal(items) - 400)).toBeLessThanOrEqual(0.15 * 400)
  })

  it('switches to 5 g steps when household units drift outside ±15 % and steps land closer', () => {
    const items = portionOption([chicken, rice, broccoli], 650)
    expect(items[0]!.servingLabel).toBeNull()
  })

  it('keeps household units when 5 g steps would not land closer', () => {
    const fillet = food({ category: 'protein', servings: [{ label: '1 fillet', grams: 225 }], per100g: { calories: 200 } })
    expect(portionOption([fillet], 2000)[0]).toMatchObject({ grams: 225, servingLabel: '1 fillet' })
  })

  it('gives a food with unknown energy its smallest realistic portion and no energy', () => {
    const mystery = food({ category: 'vegetable', per100g: { calories: null } })
    const items = portionOption([chicken, mystery], 300)
    expect(items[1]).toMatchObject({ grams: PORTION_GRAMS.vegetable.min })
    expect(items[1]!.nutrients.calories).toBeNull()
    expect(Math.abs(kcal(items) - 300)).toBeLessThanOrEqual(0.15 * 300)
  })

  it('keeps zero-energy sides at their smallest realistic portion', () => {
    const water = food({ category: 'vegetable', per100g: { calories: 0 } })
    const items = portionOption([chicken, water], 900)
    expect(items[1]!.grams).toBe(PORTION_GRAMS.vegetable.min)
    expect(items[0]!.grams).toBe(200)
  })
})
