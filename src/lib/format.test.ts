import { describe, expect, it } from 'vitest'
import {
  UNKNOWN_VALUE,
  formatDateLabel,
  formatDuration,
  formatGrams,
  formatHeight,
  formatKcal,
  formatLongDate,
  formatNumber,
  formatNutrient,
  formatPercent,
  formatTime,
  formatWeight,
  formatWeightDelta,
} from './format'

describe('formatNumber', () => {
  it('groups thousands and rounds to the requested decimals', () => {
    expect(formatNumber(1250.4)).toBe('1,250')
    expect(formatNumber(2.25, 1)).toBe('2.3')
    expect(formatNumber(3, 2)).toBe('3.00')
  })

  it('treats null, undefined, NaN and Infinity as unknown', () => {
    expect(formatNumber(null)).toBe(UNKNOWN_VALUE)
    expect(formatNumber(undefined)).toBe(UNKNOWN_VALUE)
    expect(formatNumber(Number.NaN)).toBe(UNKNOWN_VALUE)
    expect(formatNumber(Number.POSITIVE_INFINITY)).toBe(UNKNOWN_VALUE)
  })

  it('never shows a negative zero', () => {
    expect(formatNumber(-0.04, 1)).toBe('0.0')
    expect(formatNumber(-0.2)).toBe('0')
  })
})

describe('formatNutrient', () => {
  it('uses the nutrient unit and decimals', () => {
    expect(formatNutrient('protein', 23.6)).toBe('24 g')
    expect(formatNutrient('iron', 2.345)).toBe('2.3 mg')
    expect(formatNutrient('vitaminD', 1.25)).toBe('1.3 µg')
    expect(formatNutrient('sodium', 1234)).toBe('1,234 mg')
    expect(formatNutrient('calories', 1849.6)).toBe('1,850 kcal')
  })

  it('renders unknown values as a dash, never as zero', () => {
    expect(formatNutrient('fiber', null)).toBe('—')
    expect(formatNutrient('fiber', undefined)).toBe('—')
  })

  it('distinguishes trace amounts from a known zero', () => {
    expect(formatNutrient('fiber', 0)).toBe('0 g')
    expect(formatNutrient('fiber', 0.3)).toBe('<1 g')
    expect(formatNutrient('fiber', 0.5)).toBe('1 g')
    expect(formatNutrient('iron', 0.04)).toBe('<0.1 mg')
  })

  it('can omit the unit', () => {
    expect(formatNutrient('carbs', 41.2, { unit: false })).toBe('41')
    expect(formatNutrient('fat', 0.2, { unit: false })).toBe('<1')
  })
})

describe('formatKcal / formatGrams', () => {
  it('formats energy and grams', () => {
    expect(formatKcal(2000)).toBe('2,000 kcal')
    expect(formatKcal(null)).toBe('—')
    expect(formatKcal(512, { unit: false })).toBe('512')
    expect(formatGrams(150.4)).toBe('150 g')
    expect(formatGrams(12.25, 1)).toBe('12.3 g')
    expect(formatGrams(null)).toBe('—')
  })
})

describe('formatWeight', () => {
  it('shows metric kilograms with one decimal by default', () => {
    expect(formatWeight(72.44, 'metric')).toBe('72.4 kg')
    expect(formatWeight(72.45, 'metric', 0)).toBe('72 kg')
  })

  it('converts to pounds for imperial', () => {
    expect(formatWeight(72.4, 'imperial')).toBe('159.6 lb')
    expect(formatWeight(100, 'imperial', 0)).toBe('220 lb')
    expect(formatWeight(100, 'imperial', 0, { unit: false })).toBe('220')
  })

  it('handles unknown weight', () => {
    expect(formatWeight(null, 'metric')).toBe('—')
  })
})

describe('formatWeightDelta', () => {
  it('signs gains and losses with plus and a true minus', () => {
    expect(formatWeightDelta(0.42, 'metric')).toBe('+0.4 kg')
    expect(formatWeightDelta(-0.31, 'metric')).toBe('−0.3 kg')
    expect(formatWeightDelta(-1, 'imperial')).toBe('−2.2 lb')
  })

  it('shows changes that round to zero without a sign', () => {
    expect(formatWeightDelta(0, 'metric')).toBe('0.0 kg')
    expect(formatWeightDelta(-0.04, 'metric')).toBe('0.0 kg')
    expect(formatWeightDelta(0.004, 'imperial', 1)).toBe('0.0 lb')
  })

  it('groups large magnitudes and handles unknown values', () => {
    expect(formatWeightDelta(-1234.5, 'metric', 0)).toBe('−1,235 kg')
    expect(formatWeightDelta(null, 'metric')).toBe('—')
  })
})

describe('formatHeight', () => {
  it('formats centimeters and feet/inches', () => {
    expect(formatHeight(177.8, 'metric')).toBe('178 cm')
    expect(formatHeight(177.8, 'imperial')).toBe('5 ft 10 in')
    expect(formatHeight(152.4, 'imperial')).toBe('5 ft 0 in')
    expect(formatHeight(null, 'imperial')).toBe('—')
  })

  it('carries 12 inches into the next foot', () => {
    expect(formatHeight(182.6, 'imperial')).toBe('6 ft 0 in')
  })
})

describe('formatDateLabel', () => {
  it('uses relative labels around today', () => {
    expect(formatDateLabel('2026-10-03', '2026-10-03')).toBe('Today')
    expect(formatDateLabel('2026-10-02', '2026-10-03')).toBe('Yesterday')
    expect(formatDateLabel('2026-10-04', '2026-10-03')).toBe('Tomorrow')
  })

  it('formats other days of the same year as "Sat, Oct 3"', () => {
    expect(formatDateLabel('2026-10-03', '2026-10-10')).toBe('Sat, Oct 3')
  })

  it('recognizes yesterday and tomorrow across month and year boundaries', () => {
    expect(formatDateLabel('2026-09-30', '2026-10-01')).toBe('Yesterday')
    expect(formatDateLabel('2025-12-31', '2026-01-01')).toBe('Yesterday')
    expect(formatDateLabel('2027-01-01', '2026-12-31')).toBe('Tomorrow')
    expect(formatDateLabel('2024-03-01', '2024-02-29')).toBe('Tomorrow')
  })

  it('adds the year for dates in another year', () => {
    expect(formatDateLabel('2025-12-30', '2026-01-01')).toBe('Tue, Dec 30, 2025')
  })

  it('returns a dash for malformed keys', () => {
    expect(formatDateLabel('2026-02-30', '2026-03-01')).toBe('—')
    expect(formatDateLabel('yesterday', '2026-03-01')).toBe('—')
  })
})

describe('formatLongDate', () => {
  it('formats the full local date', () => {
    expect(formatLongDate('2026-10-03')).toBe('Saturday, October 3, 2026')
    expect(formatLongDate('not-a-date')).toBe('—')
  })
})

describe('formatTime', () => {
  it('formats the local clock time of an instant', () => {
    expect(formatTime(new Date(2026, 9, 3, 8, 5).toISOString())).toBe('8:05 AM')
    expect(formatTime(new Date(2026, 9, 3, 19, 30).toISOString())).toBe('7:30 PM')
  })

  it('returns a dash for missing or invalid timestamps', () => {
    expect(formatTime(null)).toBe('—')
    expect(formatTime('')).toBe('—')
    expect(formatTime('not a time')).toBe('—')
  })
})

describe('formatDuration', () => {
  it('formats minutes and hours', () => {
    expect(formatDuration(45)).toBe('45 min')
    expect(formatDuration(75)).toBe('1 h 15 min')
    expect(formatDuration(120)).toBe('2 h')
    expect(formatDuration(0)).toBe('0 min')
  })

  it('rounds to whole minutes before splitting', () => {
    expect(formatDuration(59.6)).toBe('1 h')
    expect(formatDuration(29.4)).toBe('29 min')
  })

  it('rejects negative or unknown durations', () => {
    expect(formatDuration(-5)).toBe('—')
    expect(formatDuration(null)).toBe('—')
  })
})

describe('formatPercent', () => {
  it('formats ratios as percentages', () => {
    expect(formatPercent(0.853)).toBe('85%')
    expect(formatPercent(1.2)).toBe('120%')
    expect(formatPercent(0)).toBe('0%')
    expect(formatPercent(0.1234, 1)).toBe('12.3%')
    expect(formatPercent(null)).toBe('—')
  })
})
