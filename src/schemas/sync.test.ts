import { describe, expect, it } from 'vitest'
import { SYNC_ENTITIES } from '@/types'
import {
  makeFavorite,
  makeFood,
  makeMeal,
  makeOutbox,
  makeProfile,
  makeSavedMeal,
  makeScheduled,
  makeWeight,
  makeWorkout,
  testId,
  USER_A,
} from './__fixtures__/records'
import { ENTITY_SCHEMAS, ownerOf, recordIdOf, type EntityRecordMap } from './entities'
import { outboxMutationSchema } from './sync'

describe('outboxMutationSchema', () => {
  it('accepts a pending upsert with a payload and a delete without one', () => {
    expect(outboxMutationSchema.safeParse(makeOutbox()).success).toBe(true)
    expect(outboxMutationSchema.safeParse(makeOutbox({ op: 'delete', payload: null })).success).toBe(true)
  })

  it('rejects upserts without payload and deletes with one', () => {
    expect(outboxMutationSchema.safeParse(makeOutbox({ payload: null })).success).toBe(false)
    expect(outboxMutationSchema.safeParse(makeOutbox({ op: 'delete' })).success).toBe(false)
  })

  it.each([
    ['entity', 'meals'],
    ['attempts', -1],
    ['attempts', 1.5],
    ['status', 'done'],
    ['nextAttemptAt', 'soon'],
    ['recordId', 'x'],
  ])('rejects %s = %j', (field, value) => {
    expect(outboxMutationSchema.safeParse({ ...makeOutbox(), [field]: value }).success).toBe(false)
  })

  it('keeps retry bookkeeping', () => {
    const failed = makeOutbox({ status: 'failed', attempts: 3, lastError: 'permission', nextAttemptAt: '2026-10-03T09:00:00Z' })
    expect(outboxMutationSchema.parse(failed).nextAttemptAt).toBe('2026-10-03T09:00:00.000Z')
  })
})

const samples: { [E in keyof EntityRecordMap]: EntityRecordMap[E] } = {
  profiles: makeProfile(),
  food_items: makeFood(),
  meal_logs: makeMeal(),
  weight_logs: makeWeight(),
  workout_logs: makeWorkout(),
  scheduled_workouts: makeScheduled(),
  favorites: makeFavorite(),
  saved_meals: makeSavedMeal(),
}

describe('ENTITY_SCHEMAS', () => {
  it.each(SYNC_ENTITIES)('%s validates its own record and rejects another entity record', (entity) => {
    expect(ENTITY_SCHEMAS[entity].safeParse(samples[entity]).success).toBe(true)
    const other = entity === 'favorites' ? samples.weight_logs : samples.favorites
    expect(ENTITY_SCHEMAS[entity].safeParse(other).success).toBe(false)
  })
})

describe('recordIdOf / ownerOf', () => {
  it('keys profiles by owner and everything else by id', () => {
    expect(recordIdOf('profiles', samples.profiles)).toBe(USER_A)
    expect(recordIdOf('meal_logs', samples.meal_logs)).toBe(testId(200))
  })

  it('reads the owner column of each entity, null for system foods', () => {
    expect(ownerOf('profiles', samples.profiles)).toBe(USER_A)
    expect(ownerOf('food_items', samples.food_items)).toBe(USER_A)
    expect(ownerOf('food_items', makeFood({ source: 'system', createdBy: null }))).toBeNull()
    expect(ownerOf('saved_meals', samples.saved_meals)).toBe(USER_A)
  })
})
