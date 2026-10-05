import { describe, expect, it } from 'vitest'
import { favoriteId, userFoodId } from '@/lib/id'
import { makeFavorite, makeFood, makeMeal, makePortion, makeSavedMeal, testId, USER_A } from '@/schemas/__fixtures__/records'
import { emptyCounts, planGuestMigration, type GuestData } from './plan'

const GUEST = '3e9f0a1b-2c3d-4e5f-8a6b-7c8d9e0f1a2b'
const NOW = '2026-10-04T10:00:00.000Z'
const noSystemFoods = () => false

function guestData(overrides: Partial<GuestData> = {}): GuestData {
  return { profile: null, foods: [], meals: [], favorites: [], savedMeals: [], weights: [], workouts: [], scheduledWorkouts: [], ...overrides }
}

describe('planGuestMigration', () => {
  it('derives one account id per provider food and drops duplicates that collapse onto it', async () => {
    const first = makeFood({ id: testId(1), createdBy: GUEST, source: 'off', externalId: '7290000000001' })
    const again = makeFood({ id: testId(2), createdBy: GUEST, source: 'off', externalId: '7290000000001' })
    const plan = await planGuestMigration(
      guestData({
        foods: [first, again],
        meals: [makeMeal({ id: testId(10), userId: GUEST, foodId: testId(2), foodSource: 'off' })],
        favorites: [makeFavorite({ id: testId(20), userId: GUEST, foodId: testId(1) }), makeFavorite({ id: testId(21), userId: GUEST, foodId: testId(2) })],
      }),
      { userId: USER_A, nowIso: NOW, isSystemFood: noSystemFoods },
    )
    const accountId = await userFoodId(USER_A, 'off', '7290000000001')
    expect(plan.foods.map((food) => [food.id, food.createdBy, food.updatedAt])).toEqual([[accountId, USER_A, NOW]])
    expect(plan.meals[0]?.foodId).toBe(accountId)
    expect(plan.favorites).toEqual([expect.objectContaining({ id: await favoriteId(USER_A, accountId), foodId: accountId })])
    expect(plan.dropped).toEqual({ ...emptyCounts(), foods: 1, favorites: 1 })
  })

  it('keeps the id of custom foods and of provider foods without an external id', async () => {
    const custom = makeFood({ id: testId(1), createdBy: GUEST })
    const noExternal = makeFood({ id: testId(2), createdBy: GUEST, source: 'usda', externalId: null })
    const plan = await planGuestMigration(guestData({ foods: [custom, noExternal] }), { userId: USER_A, nowIso: NOW, isSystemFood: noSystemFoods })
    expect(plan.foods.map((food) => food.id)).toEqual([testId(1), testId(2)])
  })

  it('keeps references to system foods and to foods the account already has; clears unknown ones', async () => {
    const item = (foodId: string | null) => makePortion({ foodId })
    const plan = await planGuestMigration(
      guestData({
        savedMeals: [makeSavedMeal({ userId: GUEST, items: [item(testId(77)), item(testId(5)), item(testId(6)), item(null)] })],
      }),
      { userId: USER_A, nowIso: NOW, isSystemFood: (id) => id === testId(77), accountFoodIds: new Set([testId(5)]) },
    )
    expect(plan.savedMeals[0]).toMatchObject({ userId: USER_A, updatedAt: NOW })
    expect(plan.savedMeals[0]?.items.map((portion) => portion.foodId)).toEqual([testId(77), testId(5), null, null])
  })

  it('re-keys the profile owner and leaves an absent profile absent', async () => {
    const empty = await planGuestMigration(guestData(), { userId: USER_A, nowIso: NOW, isSystemFood: noSystemFoods })
    expect(empty.profile).toBeNull()
    expect(empty.dropped).toEqual(emptyCounts())
  })
})
