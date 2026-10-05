import { describe, expect, it } from 'vitest'
import { SYSTEM_FOODS } from '@/data/systemFoods'
import type { FoodItem } from '@/types'
import { food, profile } from './__fixtures__/adaptive'
import { rankingContext } from './__fixtures__/ranking'
import { buildMealOptions, type BuildOptionsInput } from './builder'
import { filterCandidates } from './candidates'
import { dishName, dishSignature, dismissedSignatures, optionId } from './dishes'

describe('dish identity', () => {
  it('names a dish by its short, lower-cased display name', () => {
    expect(dishName({ name: 'Brown rice, cooked' })).toBe('brown rice')
    expect(dishName({ name: '  Hummus (homemade) ' })).toBe('hummus')
    expect(dishName({ name: 'Hummus' })).toBe(dishName({ name: 'hummus, store-bought' }))
  })

  it('gives options the same signature whatever the food order or ids', () => {
    const a = [{ name: 'Lentils' }, { name: 'Pita bread, white' }]
    const b = [{ name: 'Pita bread (bakery)' }, { name: 'lentils' }]
    expect(dishSignature(a)).toBe('lentils+pita bread')
    expect(dishSignature(b)).toBe(dishSignature(a))
  })

  it('builds option ids from the style, meal and sorted food ids', () => {
    expect(optionId('balanced', 'lunch', ['b', 'a', 'c'])).toBe('balanced:lunch:a+b+c')
  })
})

describe('dismissedSignatures', () => {
  const lentils = food({ id: 'lentils-1', name: 'Lentils, cooked' })
  const pita = food({ id: 'pita-1', name: 'Pita bread' })
  const foods = [lentils, pita]

  it('reads the dishes of options dismissed for this meal', () => {
    const signatures = dismissedSignatures(['quick:lunch:lentils-1+pita-1', 'balanced:lunch:lentils-1'], foods, 'lunch')
    expect([...signatures].sort()).toEqual(['lentils', 'lentils+pita bread'])
  })

  it('skips other meals, malformed ids and foods it cannot find', () => {
    const ids = ['quick:dinner:lentils-1', 'lentils-1', ':lunch:lentils-1', 'balanced:lunch:', 'balanced:lunch:lentils-1+gone']
    expect(dismissedSignatures(ids, foods, 'lunch').size).toBe(0)
  })
})

describe('meal builder — dishes with the same name', () => {
  const catalog = filterCandidates(SYSTEM_FOODS, { profile: profile(), mealType: 'lunch' }).candidates
  /** A saved copy of every catalog food: different ids, same dishes. */
  const copies: FoodItem[] = catalog.map((item) => ({ ...item, id: `${item.id}-copy`, name: `${item.name} (saved copy)` }))
  const build = (overrides: Partial<BuildOptionsInput> = {}) =>
    buildMealOptions({ candidates: [...catalog, ...copies], ctx: rankingContext(), dismissedIds: new Set(), variant: 0, ...overrides })
  const { options } = build()

  it('never lists one dish twice in an option', () => {
    for (const option of options) {
      const names = option.items.map((item) => dishName(item.food))
      expect(new Set(names).size).toBe(names.length)
    }
  })

  it('shows options that read the same only once, each with its own anchor', () => {
    expect(new Set(options.map((option) => option.signature)).size).toBe(options.length)
    expect(new Set(options.map((option) => option.anchorDish)).size).toBe(options.length)
    for (const option of options) expect(option.signature).toBe(dishSignature(option.items.map((item) => item.food)))
  })

  it('keeps a dismissed option away under another style or with same-named foods', () => {
    const first = options[0]!
    const after = build({ dismissedIds: new Set([first.id]) })
    expect(after.dismissedAny).toBe(true)
    expect(after.options.map((option) => option.signature)).not.toContain(first.signature)
  })
})
