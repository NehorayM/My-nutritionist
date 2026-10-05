import { describe, expect, it } from 'vitest'
import { byScoreThenFoodId, compareIds } from './order'

describe('compareIds', () => {
  it('orders by code unit, independent of locale, and treats equal ids as equal', () => {
    expect(compareIds('a', 'b')).toBe(-1)
    expect(compareIds('b', 'a')).toBe(1)
    expect(compareIds('B', 'a')).toBe(-1)
    expect(compareIds('same', 'same')).toBe(0)
  })
})

describe('byScoreThenFoodId', () => {
  it('sorts the best score first and breaks ties by food id', () => {
    const entries = [
      { food: { id: 'b' }, score: 0.5 },
      { food: { id: 'c' }, score: 0.9 },
      { food: { id: 'a' }, score: 0.5 },
      { food: { id: 'a' }, score: 0.5 },
    ]
    expect([...entries].sort(byScoreThenFoodId).map((entry) => entry.food.id)).toEqual(['c', 'a', 'a', 'b'])
  })
})
