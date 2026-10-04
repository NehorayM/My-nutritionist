import { describe, expect, it } from 'vitest'
import {
  boundedText,
  dateKeySchema,
  dateRangeSchema,
  intInRange,
  isoTimestampSchema,
  numberInRange,
  positiveUpTo,
  textLength,
  uuidSchema,
} from './primitives'

describe('uuidSchema', () => {
  it.each([
    ['0b6f6c1e-8d3a-4f2b-9c1d-2e3f4a5b6c7d', true],
    ['0B6F6C1E-8D3A-5F2B-9C1D-2E3F4A5B6C7D', true],
    ['0b6f6c1e-8d3a-4f2b-7c1d-2e3f4a5b6c7d', false],
    ['0b6f6c1e8d3a4f2b9c1d2e3f4a5b6c7d', false],
    ['', false],
  ])('%s → %s', (value, valid) => {
    expect(uuidSchema.safeParse(value).success).toBe(valid)
  })
})

describe('dateKeySchema', () => {
  it.each([
    ['2026-10-03', true],
    ['2024-02-29', true],
    ['2026-02-29', false],
    ['2026-04-31', false],
    ['2026-13-01', false],
    ['2026-1-01', false],
    ['2026-10-03T00:00:00Z', false],
  ])('%s → %s', (value, valid) => {
    expect(dateKeySchema.safeParse(value).success).toBe(valid)
  })
})

describe('isoTimestampSchema', () => {
  it('canonicalizes offsets and Postgres microseconds to UTC milliseconds', () => {
    expect(isoTimestampSchema.parse('2026-10-03T12:34:56.789012+00:00')).toBe('2026-10-03T12:34:56.789Z')
    expect(isoTimestampSchema.parse('2026-10-03T12:34:56.789+03:00')).toBe('2026-10-03T09:34:56.789Z')
    expect(isoTimestampSchema.parse('2026-10-03T12:34:56Z')).toBe('2026-10-03T12:34:56.000Z')
  })

  it.each(['2026-10-03T12:34:56', '2026-10-03 12:34:56+00:00', '2026-02-30T12:00:00Z', 'yesterday', ''])(
    'rejects %j (no zone, not ISO, or not a real instant)',
    (value) => {
      expect(isoTimestampSchema.safeParse(value).success).toBe(false)
    },
  )
})

describe('boundedText', () => {
  it('counts Unicode code points like Postgres char_length', () => {
    expect(textLength('שלום')).toBe(4)
    expect(textLength('🍎🍐')).toBe(2)
    const schema = boundedText(1, 3)
    expect(schema.safeParse('🍎🍐🍊').success).toBe(true)
    expect(schema.safeParse('🍎🍐🍊🍋').success).toBe(false)
    expect(schema.safeParse('').success).toBe(false)
  })

  it('allows empty text when the minimum is 0', () => {
    expect(boundedText(0, 2).safeParse('').success).toBe(true)
    expect(boundedText(0, 2).safeParse('abc').error?.issues[0]?.message).toBe('Must be at most 2 characters')
  })
})

describe('numeric helpers', () => {
  it('numberInRange is inclusive and rejects non-finite values', () => {
    const schema = numberInRange({ min: 20, max: 400 })
    expect(schema.safeParse(20).success).toBe(true)
    expect(schema.safeParse(400).success).toBe(true)
    expect(schema.safeParse(19.99).success).toBe(false)
    expect(schema.safeParse(400.01).success).toBe(false)
    expect(schema.safeParse(Number.NaN).success).toBe(false)
    expect(schema.safeParse(Number.POSITIVE_INFINITY).success).toBe(false)
  })

  it('intInRange rejects fractions', () => {
    expect(intInRange({ min: 1, max: 600 }).safeParse(30.5).success).toBe(false)
    expect(intInRange({ min: 1, max: 600 }).safeParse(600).success).toBe(true)
  })

  it('positiveUpTo excludes zero', () => {
    expect(positiveUpTo(10).safeParse(0).success).toBe(false)
    expect(positiveUpTo(10).safeParse(0.001).success).toBe(true)
    expect(positiveUpTo(10).safeParse(10).success).toBe(true)
  })
})

describe('dateRangeSchema', () => {
  it('requires real date keys on both ends', () => {
    expect(dateRangeSchema.safeParse({ from: '2026-10-01', to: '2026-10-07' }).success).toBe(true)
    expect(dateRangeSchema.safeParse({ from: '2026-10-01', to: '2026-10-32' }).success).toBe(false)
  })
})
