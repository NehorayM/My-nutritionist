import { describe, expect, it, vi } from 'vitest'
import { logger } from '@/lib/logger'
import { RepositoryError } from '@/repositories/types'
import { makeFood, makeMeal, makeWeight, testId, USER_A, USER_B } from './__fixtures__/records'
import {
  checkDateRange,
  normalizeLimit,
  parseOwnedRecord,
  parseOwnedRecords,
  readOwner,
  RECORD_SPECS,
  validateForWrite,
} from './records'

describe('readOwner', () => {
  it('reads string owner fields only', () => {
    expect(readOwner({ userId: USER_A }, 'userId')).toBe(USER_A)
    expect(readOwner({ createdBy: null }, 'createdBy')).toBeNull()
    expect(readOwner({ userId: 42 }, 'userId')).toBeNull()
    expect(readOwner({}, 'userId')).toBeNull()
    expect(readOwner(null, 'userId')).toBeNull()
    expect(readOwner('user', 'userId')).toBeNull()
  })
})

describe('parseOwnedRecords', () => {
  it('keeps valid records of the user, ignores other owners, warns once about invalid ones', () => {
    const warn = vi.spyOn(logger, 'warn')
    const mine = makeMeal({ id: testId(1) })
    const values = [
      mine,
      makeMeal({ id: testId(2), userId: USER_B }),
      { ...makeMeal({ id: testId(3) }), grams: 0 },
      { ...makeMeal({ id: testId(4) }), foodName: '' },
      'not a record',
    ]
    expect(parseOwnedRecords(RECORD_SPECS.meal_logs, values, USER_A, 'test-scope')).toEqual([mine])
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledWith('test-scope', 'Skipped 2 invalid meal entry record(s)')
  })

  it('does not warn when everything is valid', () => {
    const warn = vi.spyOn(logger, 'warn')
    expect(parseOwnedRecords(RECORD_SPECS.weight_logs, [makeWeight()], USER_A, 's')).toHaveLength(1)
    expect(warn).not.toHaveBeenCalled()
  })

  it('parseOwnedRecord returns null for missing, foreign and invalid values', () => {
    const spec = RECORD_SPECS.weight_logs
    expect(parseOwnedRecord(spec, undefined, USER_A, 's')).toBeNull()
    expect(parseOwnedRecord(spec, null, USER_A, 's')).toBeNull()
    expect(parseOwnedRecord(spec, makeWeight({ userId: USER_B }), USER_A, 's')).toBeNull()
    expect(parseOwnedRecord(spec, { ...makeWeight(), weightKg: 19 }, USER_A, 's')).toBeNull()
    expect(parseOwnedRecord(spec, makeWeight(), USER_A, 's')).toEqual(makeWeight())
  })
})

describe('validateForWrite', () => {
  it('returns the canonical record', () => {
    const saved = validateForWrite(RECORD_SPECS.weight_logs, makeWeight({ measuredAt: '2026-10-03T08:30:00+03:00' }), USER_A)
    expect(saved.measuredAt).toBe('2026-10-03T05:30:00.000Z')
  })

  it('rejects records of another user and system foods as non-retryable', () => {
    expect(() => validateForWrite(RECORD_SPECS.weight_logs, makeWeight({ userId: USER_B }), USER_A)).toThrow(
      new RepositoryError('Cannot save a weigh-in that belongs to a different user', { retryable: false }),
    )
    const system = makeFood({ source: 'system', createdBy: null })
    expect(() => validateForWrite(RECORD_SPECS.food_items, system, USER_A)).toThrow(/different user/)
  })

  it('names failing field paths but never their values', () => {
    const invalid = makeMeal({ foodName: 'Secret soup', grams: -5, per100g: { ...makeMeal().per100g, calories: 1200 } })
    const attempt = () => validateForWrite(RECORD_SPECS.meal_logs, invalid, USER_A)
    expect(attempt).toThrow(RepositoryError)
    expect(attempt).toThrow(expect.objectContaining({ retryable: false }))
    expect(attempt).toThrow(/^Invalid meal entry: check grams, per100g\.calories$/)
  })
})

describe('checkDateRange', () => {
  it('accepts inclusive ranges, returns null for empty ones, rejects unreal dates', () => {
    expect(checkDateRange({ from: '2026-10-01', to: '2026-10-01' })).toEqual({ from: '2026-10-01', to: '2026-10-01' })
    expect(checkDateRange({ from: '2026-10-02', to: '2026-10-01' })).toBeNull()
    expect(() => checkDateRange({ from: '2026-02-29', to: '2026-03-01' })).toThrow(RepositoryError)
    expect(() => checkDateRange({ from: '2026-10-01', to: '10/03/2026' })).toThrow(/real YYYY-MM-DD/)
  })
})

describe('normalizeLimit', () => {
  it.each([
    [10, 10],
    [2.9, 2],
    [1, 1],
    [0.5, 0],
    [0, 0],
    [-3, 0],
    [Number.NaN, 0],
    [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY],
  ])('%d → %d', (input, expected) => {
    expect(normalizeLimit(input)).toBe(expected)
  })
})
