import { describe, expect, it } from 'vitest'
import { emptyTotals } from '@/domain/nutrients'
import type { NutrientTarget } from '@/domain/nutrition'
import { FoodProviderError } from '@/services/food'
import type { NutrientTotal } from '@/types'
import { inSentence, providerStatusMessage, repeatLabelFor, repeatedMessageFor } from './labels'
import { amountCopy, calorieCopy, knownValue, missingDataNote } from './summary'

const total = (value: number, knownCount = 1, missingCount = 0): NutrientTotal => ({ value, knownCount, missingCount })
const target = (amount: number): NutrientTarget => ({ amount, min: null, max: null, kind: 'energy' })

describe('summary copy', () => {
  it('words calories as remaining, at target or above target (never as a problem)', () => {
    expect(calorieCopy(total(1240), target(2000))).toMatchObject({ consumed: '1,240', status: '760 kcal remaining' })
    expect(calorieCopy(total(1998), target(2000)).status).toBe('At your target')
    expect(calorieCopy(total(2300), target(2000))).toMatchObject({
      status: 'Above target by 300 kcal',
      valueText: '2,300 kcal of 2,000 kcal, above target by 300 kcal',
    })
    expect(calorieCopy(total(0, 0, 0), undefined)).toMatchObject({ status: null, target: null, valueText: '0 kcal eaten' })
  })

  it('shows unknown totals as — and amounts against targets', () => {
    expect(knownValue(total(0, 0, 2))).toBeNull()
    expect(amountCopy('protein', total(0, 0, 1), target(100)).text).toBe('— / 100 g')
    expect(amountCopy('protein', total(112.4), target(100))).toMatchObject({ text: '112 / 100 g', valueText: '112 g of 100 g, 12 g above target' })
  })

  it('explains missing data honestly', () => {
    const totals = emptyTotals()
    expect(missingDataNote(totals, ['fiber'])).toBeNull()
    totals.fiber = total(3, 1, 1)
    totals.vitaminD = total(0, 0, 2)
    totals.sodium = total(0, 0, 2)
    expect(missingDataNote(totals, ['fiber', 'sodium', 'vitaminD'])).toBe(
      'Fiber isn’t reported for some foods, so this total may be higher. Sodium and vitamin D aren’t reported for these foods.',
    )
  })
})

describe('labels', () => {
  it('names repeat actions by the previous day', () => {
    expect(repeatLabelFor('snack', 'Yesterday')).toBe('Repeat yesterday’s snacks')
    expect(repeatLabelFor('lunch', 'Thu, Oct 1')).toBe('Repeat lunch from Thu, Oct 1')
    expect(repeatedMessageFor('breakfast', 'Yesterday')).toBe('Repeated yesterday’s breakfast')
    expect(inSentence('Today')).toBe('today')
    expect(inSentence('Sat, Oct 3')).toBe('Sat, Oct 3')
  })

  it('explains provider outcomes without blaming the user', () => {
    expect(providerStatusMessage('usda', 'ok')).toBeNull()
    expect(providerStatusMessage('usda', 'skipped')).toBeNull()
    expect(providerStatusMessage('off', 'rate_limited', new FoodProviderError('off', 'rate_limited', 'x', 200_000))).toBe(
      'Packaged product search allows about 10 searches a minute. Try again in a few minutes.',
    )
    expect(providerStatusMessage('usda', 'invalid_response')).toBe('USDA search had a problem answering. Try again later.')
  })
})
