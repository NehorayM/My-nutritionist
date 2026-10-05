import { describe, expect, it } from 'vitest'
import { food, systemFood } from './__fixtures__/adaptive'
import { canAnchor, canSide, componentRole, isStarchBase, pairs, substantialAnchor } from './pairing'

const oats = systemFood('rolled_oats')
const bread = systemFood('whole_wheat_bread')
const pita = systemFood('pita_white')
const rice = systemFood('white_rice_cooked')
const chicken = systemFood('chicken_breast_roasted')
const yogurt = systemFood('greek_yogurt_plain')
const mozzarella = systemFood('mozzarella_part_skim')
const shakshuka = systemFood('shakshuka')
const shawarma = systemFood('shawarma_in_pita')
const hummus = systemFood('hummus')
const fries = systemFood('french_fries_fast_food')
const tomato = systemFood('tomato')
const apple = systemFood('apple')
const orangeJuice = systemFood('orange_juice')

describe('componentRole', () => {
  it('splits breakfast cereals from breads and cooked grains', () => {
    expect(componentRole(oats)).toBe('cereal')
    expect(componentRole(rice)).toBe('grain')
    expect(componentRole(food({ category: 'grain', mealTypes: [] }))).toBe('grain')
  })

  it('splits cheese from lighter dairy', () => {
    expect(componentRole(mozzarella)).toBe('cheese')
    expect(componentRole(yogurt)).toBe('dairy')
    expect(componentRole(food({ category: 'dairy', per100g: { calories: null } }))).toBe('dairy')
  })

  it('treats protein-rich fast food, prepared and Israeli foods as complete dishes', () => {
    expect(componentRole(shakshuka)).toBe('dish')
    expect(componentRole(shawarma)).toBe('dish')
    expect(componentRole(food({ category: 'prepared', per100g: { calories: 200, protein: 12 } }))).toBe('dish')
    expect(componentRole(hummus)).toBe('israeli')
    expect(componentRole(fries)).toBe('fast_food')
    expect(componentRole(food({ category: null }))).toBeNull()
  })
})

describe('isStarchBase', () => {
  it('covers grains, cereals and wheat-based dishes', () => {
    expect([bread, oats, rice, pita, shawarma, systemFood('cheese_pizza')].every(isStarchBase)).toBe(true)
    expect([hummus, chicken, fries, tomato].some(isStarchBase)).toBe(false)
    expect(isStarchBase(food({ category: 'prepared', allergens: null, per100g: { carbs: 40 } }))).toBe(false)
    expect(isStarchBase(food({ category: 'prepared', allergens: ['wheat'], per100g: { carbs: null } }))).toBe(false)
    expect(isStarchBase(food({ category: 'prepared', allergens: ['wheat'], per100g: { carbs: 15 } }))).toBe(true)
    expect(isStarchBase(food({ category: null, allergens: ['wheat'], per100g: { carbs: 40 } }))).toBe(true)
    expect(isStarchBase(food({ category: null, allergens: ['wheat'], per100g: { carbs: 5 } }))).toBe(false)
    expect(isStarchBase(food({ category: null, allergens: null, per100g: { carbs: 40 } }))).toBe(false)
  })
})

describe('pairs', () => {
  it('pairs everyday plates in either order', () => {
    expect(pairs(chicken, rice, 'lunch')).toBe(true)
    expect(pairs(rice, chicken, 'dinner')).toBe(true)
    expect(pairs(yogurt, oats, 'breakfast')).toBe(true)
    expect(pairs(shakshuka, pita, 'breakfast')).toBe(true)
    expect(pairs(apple, systemFood('almonds'), 'snack')).toBe(true)
  })

  it('keeps unusual combinations apart', () => {
    expect(pairs(mozzarella, oats, 'breakfast')).toBe(false)
    expect(pairs(chicken, yogurt, 'lunch')).toBe(false)
    expect(pairs(chicken, apple, 'dinner')).toBe(false)
  })

  it('never combines two bread or grain bases', () => {
    expect(pairs(shawarma, pita, 'lunch')).toBe(false)
    expect(pairs(bread, food({ category: null, allergens: ['wheat'], per100g: { carbs: 45 } }), 'lunch')).toBe(false)
  })

  it('lets uncategorized foods pair with anything else', () => {
    expect(pairs(food({ category: null }), chicken, 'lunch')).toBe(true)
    expect(pairs(tomato, food({ category: null }), 'snack')).toBe(true)
  })
})

describe('anchors and sides', () => {
  it('needs 15 % of energy from protein for a main-meal anchor (breads and cereals may anchor breakfast)', () => {
    expect(substantialAnchor(rice, 'lunch')).toBe(false)
    expect(substantialAnchor(chicken, 'lunch')).toBe(true)
    expect(substantialAnchor(oats, 'breakfast')).toBe(true)
    expect(substantialAnchor(food({ category: null, per100g: { calories: 100, protein: 1 } }), 'breakfast')).toBe(false)
    expect(substantialAnchor(apple, 'snack')).toBe(true)
  })

  it('anchors options on substantial foods of anchor roles', () => {
    expect(canAnchor(chicken, 'dinner')).toBe(true)
    expect(canAnchor(shakshuka, 'dinner')).toBe(true)
    expect(canAnchor(tomato, 'lunch')).toBe(false)
    expect(canAnchor(apple, 'snack')).toBe(true)
    expect(canAnchor(orangeJuice, 'snack')).toBe(false)
    expect(canAnchor(food({ category: null, per100g: { calories: 100, protein: 10 } }), 'lunch')).toBe(true)
    expect(canAnchor(food({ category: null, per100g: { calories: 100, protein: 1 } }), 'lunch')).toBe(false)
  })

  it('never adds a complete dish as a side; drinks only at breakfast', () => {
    expect(canSide(shakshuka, 'lunch')).toBe(false)
    expect(canSide(tomato, 'lunch')).toBe(true)
    expect(canSide(orangeJuice, 'breakfast')).toBe(true)
    expect(canSide(orangeJuice, 'lunch')).toBe(false)
    expect(canSide(oats, 'snack')).toBe(true)
    expect(canSide(food({ category: null }), 'dinner')).toBe(true)
  })
})
