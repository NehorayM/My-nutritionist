import { describe, expect, it } from 'vitest'
import { nutrientProfile } from '../nutrients'
import { profile, targetsFor } from './__fixtures__/adaptive'
import { explainOption, joinList, nutrientPhrase, optionHighlights, optionTitle, shortName } from './explanations'
import { planMessage, type PlanMessageInput } from './messages'

const targets = targetsFor(profile()).targets

describe('optionHighlights', () => {
  const totals = nutrientProfile({ protein: 40, fiber: 9, iron: 4, vitaminC: 60, calcium: 50, potassium: null })

  it('lists nutrients with at least 20 % of the daily target, today’s gaps first, at most three', () => {
    expect(optionHighlights(totals, targets, [])).toEqual(['protein', 'fiber', 'iron'])
    expect(optionHighlights(totals, targets, ['vitaminC', 'iron'])).toEqual(['vitaminC', 'iron', 'protein'])
  })

  it('ignores unknown values, nutrients without a target and small amounts', () => {
    expect(optionHighlights(nutrientProfile({ protein: 5, potassium: null }), targets, ['potassium'])).toEqual([])
    expect(optionHighlights(totals, { protein: targets.protein! }, [])).toEqual(['protein'])
  })
})

describe('explainOption', () => {
  it('names highlights for regular options that fit the budget', () => {
    expect(explainOption({ style: 'balanced', highlights: ['protein', 'fiber'], energyState: 'normal', fitsBudget: true })).toBe(
      'High in protein and fiber while fitting your remaining calorie target.',
    )
    expect(explainOption({ style: 'quick', highlights: ['iron'], energyState: 'normal', fitsBudget: false })).toBe(
      'High in iron in a portion sized for this meal.',
    )
  })

  it('describes the style when nothing stands out', () => {
    expect(explainOption({ style: 'budget', highlights: [], energyState: 'normal', fitsBudget: true })).toBe(
      'A budget-friendly option that fits your remaining calorie target.',
    )
    expect(explainOption({ style: 'no_cook', highlights: [], energyState: 'normal', fitsBudget: false })).toBe(
      'A no-cook option, in a portion sized for this meal.',
    )
  })

  it('frames light options around what they add', () => {
    expect(explainOption({ style: 'light', highlights: ['fiber', 'vitaminC'], energyState: 'normal', fitsBudget: false })).toBe(
      'A lighter option that adds fiber and vitamin C.',
    )
    expect(explainOption({ style: 'balanced', highlights: [], energyState: 'surplus', fitsBudget: true })).toBe(
      'A lighter option to round out the day.',
    )
  })
})

describe('titles and phrases', () => {
  it('builds titles from short component names', () => {
    expect(shortName({ name: 'Brown rice, cooked' })).toBe('Brown rice')
    expect(shortName({ name: 'Tofu (firm)' })).toBe('Tofu')
    expect(shortName({ name: '(unnamed)' })).toBe('(unnamed)')
    expect(optionTitle([{ name: 'Chicken breast, roasted' }, { name: 'Brown rice, cooked' }, { name: 'Broccoli' }])).toBe(
      'Chicken breast with brown rice and broccoli',
    )
    expect(optionTitle([{ name: 'Shakshuka' }, { name: 'Israeli salad' }])).toBe('Shakshuka with Israeli salad')
    expect(optionTitle([{ name: 'Apple' }])).toBe('Apple')
    expect(optionTitle([])).toBe('')
  })

  it('joins lists naturally and reads nutrient labels mid-sentence', () => {
    expect([joinList([]), joinList(['a']), joinList(['a', 'b']), joinList(['a', 'b', 'c'])]).toEqual(['', 'a', 'a and b', 'a, b and c'])
    expect(nutrientPhrase('vitaminC')).toBe('vitamin C')
    expect(nutrientPhrase('protein')).toBe('protein')
  })
})

describe('planMessage', () => {
  const base: PlanMessageInput = {
    status: 'ok',
    targetMeal: 'dinner',
    energyState: 'normal',
    gaps: [],
    foodsAvailable: true,
    allDismissed: false,
  }

  it('summarizes regular days by meal and the first two gaps', () => {
    expect(planMessage(base)).toBe("Options for dinner that fit what's left of today.")
    expect(planMessage({ ...base, targetMeal: 'snack', gaps: ['protein', 'iron', 'fiber'] })).toBe(
      'Options for a snack that add protein and iron to your day.',
    )
  })

  it('uses neutral framing for surplus and light days', () => {
    expect(planMessage({ ...base, energyState: 'surplus' })).toBe(
      "Today's intake is already above your energy target — lighter, fiber-rich options can round out the day.",
    )
    expect(planMessage({ ...base, energyState: 'light' })).toBe("You're close to your energy target — lighter options can round out the day.")
  })

  it('explains empty states', () => {
    expect(planMessage({ ...base, allDismissed: true })).toContain('set aside')
    expect(planMessage({ ...base, status: 'past_day', targetMeal: null })).toBe('Suggestions are for today and the days ahead.')
    expect(planMessage({ ...base, status: 'day_complete', targetMeal: null })).toContain('fresh suggestions')
    expect(planMessage({ ...base, status: 'no_candidates' })).toContain('reviewing allergies, dislikes, diet or prep time')
    expect(planMessage({ ...base, status: 'no_candidates', targetMeal: null })).toContain('for this meal')
    expect(planMessage({ ...base, status: 'no_candidates', foodsAvailable: false })).toContain('adding foods')
  })
})
