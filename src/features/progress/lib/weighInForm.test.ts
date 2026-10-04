import { describe, expect, it } from 'vitest'
import type { WeightEntry } from '@/types'
import { draftFromEntry, localDateTimeToIso, newWeighInDraft, toTimeValue, validateWeighIn, type WeighInDraft } from './weighInForm'

const NOW = new Date(2026, 9, 7, 7, 30)

function draft(patch: Partial<WeighInDraft> = {}): WeighInDraft {
  return { weight: 71.2, date: '2026-10-07', time: '07:30', note: '', ...patch }
}

const entry: WeightEntry = {
  id: 'w1',
  userId: 'u1',
  date: '2026-10-06',
  measuredAt: new Date(2026, 9, 6, 6, 5).toISOString(),
  weightKg: 71.21,
  inputUnit: 'lb',
  note: 'Travel day',
  createdAt: '2026-10-06T06:05:00.000Z',
  updatedAt: '2026-10-06T06:05:00.000Z',
}

describe('weigh-in form helpers', () => {
  it('builds local date/time values', () => {
    expect(toTimeValue(new Date(2026, 0, 2, 6, 5))).toBe('06:05')
    expect(newWeighInDraft(NOW)).toEqual({ weight: null, date: '2026-10-07', time: '07:30', note: '' })
    expect(localDateTimeToIso('2026-10-07', '07:30')).toBe(NOW.toISOString())
    expect(localDateTimeToIso('2026-10-07', '24:00')).toBeNull()
    expect(localDateTimeToIso('2026-13-01', '07:30')).toBeNull()
  })

  it('prefills a stored entry in the user unit', () => {
    expect(draftFromEntry(entry, 'imperial')).toEqual({ weight: 157, date: '2026-10-06', time: '06:05', note: 'Travel day' })
    expect(draftFromEntry(entry, 'metric').weight).toBe(71.21)
  })
})

describe('validateWeighIn', () => {
  it('converts to kg, an ISO instant and a trimmed note', () => {
    expect(validateWeighIn(draft({ note: '  after a run ' }), { unitSystem: 'metric', now: NOW })).toEqual({
      ok: true,
      values: { weightKg: 71.2, inputUnit: 'kg', date: '2026-10-07', measuredAt: NOW.toISOString(), note: 'after a run' },
    })
    const imperial = validateWeighIn(draft({ weight: 157, note: '   ' }), { unitSystem: 'imperial', now: NOW })
    expect(imperial).toMatchObject({ ok: true, values: { weightKg: 71.21, inputUnit: 'lb', note: null } })
  })

  it('reports every invalid field', () => {
    const result = validateWeighIn(draft({ weight: null, date: '', time: '', note: 'x'.repeat(281) }), {
      unitSystem: 'metric',
      now: NOW,
    })
    expect(result).toEqual({
      ok: false,
      errors: {
        weight: 'Enter your weight.',
        date: 'Choose a date.',
        time: 'Enter a time.',
        note: 'Keep the note to 280 characters or fewer.',
      },
    })
  })

  it('counts characters, not UTF-16 units, for the note limit', () => {
    const emoji = '🙂'.repeat(280)
    expect(validateWeighIn(draft({ note: emoji }), { unitSystem: 'metric', now: NOW }).ok).toBe(true)
  })

  it('rejects future days and times beyond a minute from now', () => {
    expect(validateWeighIn(draft({ date: '2026-10-08' }), { unitSystem: 'metric', now: NOW })).toMatchObject({
      ok: false,
      errors: { date: 'Choose today or an earlier date.' },
    })
    expect(validateWeighIn(draft({ time: '07:31' }), { unitSystem: 'metric', now: NOW }).ok).toBe(true)
    expect(validateWeighIn(draft({ time: '07:32' }), { unitSystem: 'metric', now: NOW })).toMatchObject({
      ok: false,
      errors: { time: 'Choose a time up to now.' },
    })
    expect(validateWeighIn(draft({ date: '2026-10-06', time: '23:59' }), { unitSystem: 'metric', now: NOW }).ok).toBe(true)
  })

  it('keeps the stored kg and unit when an edited weight is unchanged', () => {
    const original = { weight: 157, weightKg: 71.21, inputUnit: 'lb' as const }
    const same = validateWeighIn(draft({ weight: 157 }), { unitSystem: 'imperial', now: NOW, original })
    expect(same).toMatchObject({ ok: true, values: { weightKg: 71.21, inputUnit: 'lb' } })
    const changed = validateWeighIn(draft({ weight: 72 }), { unitSystem: 'metric', now: NOW, original })
    expect(changed).toMatchObject({ ok: true, values: { weightKg: 72, inputUnit: 'kg' } })
  })
})
