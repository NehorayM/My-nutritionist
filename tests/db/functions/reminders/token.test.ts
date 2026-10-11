import { describe, expect, it } from 'vitest'
import { safeEqual, signUnsubscribeToken, verifyUnsubscribeToken } from '../../../../supabase/functions/reminders/token.ts'
import { SCHEDULE, USER } from './fakes.ts'

const KEY = 'test-signing-key-0123456789'

describe('unsubscribe tokens', () => {
  it('round-trips the schedule and user of a signed token', async () => {
    const token = await signUnsubscribeToken(KEY, SCHEDULE, USER)
    expect(await verifyUnsubscribeToken(KEY, token)).toEqual({ scheduleId: SCHEDULE, userId: USER })
  })

  it('rejects tampered, foreign-key and malformed tokens', async () => {
    const token = await signUnsubscribeToken(KEY, SCHEDULE, USER)
    const [schedule, , signature] = token.split('.')
    const otherUser = '3c9e7d2f-9e4b-4a3c-8d2e-3f4a5b6c7d8e'
    expect(await verifyUnsubscribeToken(KEY, `${schedule}.${otherUser}.${signature}`)).toBeNull()
    expect(await verifyUnsubscribeToken('another-key', token)).toBeNull()
    expect(await verifyUnsubscribeToken(KEY, `${token}.extra`)).toBeNull()
    expect(await verifyUnsubscribeToken(KEY, 'not-a-token')).toBeNull()
    expect(await verifyUnsubscribeToken(KEY, `x.${USER}.${signature}`)).toBeNull()
  })

  it('compares secrets in constant time semantics', () => {
    expect(safeEqual('abc', 'abc')).toBe(true)
    expect(safeEqual('abc', 'abd')).toBe(false)
    expect(safeEqual('abc', 'abcd')).toBe(false)
    expect(safeEqual('', '')).toBe(true)
  })
})
