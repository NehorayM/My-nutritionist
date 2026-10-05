import { describe, expect, it } from 'vitest'
import { TODAY, entry, food } from './__fixtures__/adaptive'
import { RECENT_WINDOW } from './constants'
import { microGapsOf, normalizeName, varietySignals } from './context'

describe('varietySignals', () => {
  const rice = food({ name: 'Brown rice', category: 'grain' })
  const chicken = food({ name: 'Chicken breast', category: 'protein' })

  it('collects ids, names and categories eaten on the planned day only', () => {
    const signals = varietySignals(
      [entry(rice, 150, 'lunch'), entry(rice, 100, 'dinner'), entry(chicken, 120, 'lunch', '2026-10-03')],
      TODAY,
      [rice, chicken],
      [],
    )
    expect([...signals.eatenIds]).toEqual([rice.id])
    expect([...signals.eatenNames]).toEqual(['brown rice'])
    expect(signals.categoryCounts.get('grain')).toBe(2)
    expect(signals.categoryCounts.has('protein')).toBe(false)
  })

  it('matches entries without a food id by name, and adds no category for unknown foods', () => {
    const byName = { ...entry(chicken, 120, 'lunch'), foodId: null, foodName: '  CHICKEN breast ' }
    const unknown = { ...entry(food({ name: 'Grandma soup' }), 200, 'lunch'), foodId: null }
    const signals = varietySignals([byName, unknown], TODAY, [rice, chicken], [])
    expect(signals.eatenIds.size).toBe(0)
    expect(signals.eatenNames.has('chicken breast')).toBe(true)
    expect(signals.categoryCounts.get('protein')).toBe(1)
    expect(signals.categoryCounts.size).toBe(1)
  })

  it('ranks recent foods by position within the window, keeping the first position of repeats', () => {
    const ids = ['a', 'b', 'a', ...Array.from({ length: RECENT_WINDOW }, (_, i) => `x${i}`)]
    const { recentRank } = varietySignals([], TODAY, [], ids)
    expect(recentRank.get('a')).toBe(0)
    expect(recentRank.get('b')).toBe(1)
    expect(recentRank.size).toBe(RECENT_WINDOW - 1)
    expect(recentRank.has(`x${RECENT_WINDOW - 1}`)).toBe(false)
  })

  it('normalizes names by trimming and lower-casing', () => {
    expect(normalizeName('  Greek Yogurt ')).toBe('greek yogurt')
  })
})

describe('microGapsOf', () => {
  it('keeps micronutrient gaps with a positive budget, in gap order', () => {
    expect(microGapsOf(['protein', 'vitaminC', 'fiber', 'iron', 'calcium'], { vitaminC: 30, iron: 5, calcium: 0 })).toEqual([
      'vitaminC',
      'iron',
    ])
    expect(microGapsOf(['protein', 'fiber'], { iron: 5 })).toEqual([])
    expect(microGapsOf(['iron', 'potassium'], { potassium: 600 })).toEqual(['potassium'])
  })
})
