import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import './support/context.ts'
import { createAdminClient, createUserClient } from './support/clients.ts'
import { createCleanup } from './support/cleanup.ts'
import { customFoodRow, favoriteRow, mealLogRow, rowId, type Row } from './support/rows.ts'
import { nextSystemFoodId } from './support/systemFoods.ts'

/** The shared system catalog is read-only to clients; custom foods are private to their creator. */
const { env, userA, userB } = inject('dbTest')
const clientA = createUserClient(env, userA)
const clientB = createUserClient(env, userB)
const admin = createAdminClient(env)
const cleanup = createCleanup(admin)
const RLS_VIOLATION = '42501'

const foodOfB: Row = customFoodRow(userB.id, { name: 'Private recipe of B' })
const foodOfA: Row = customFoodRow(userA.id, { name: 'Private recipe of A' })
const systemFoodId = nextSystemFoodId()

beforeAll(async () => {
  for (const [client, food] of [
    [clientB, foodOfB],
    [clientA, foodOfA],
  ] as const) {
    const { error } = await client.from('food_items').insert(food)
    if (error) throw new Error(`Arrange custom food: ${error.message}`)
    cleanup.track('food_items', rowId(food))
  }
})

afterAll(() => cleanup.run())

describe('creating foods', () => {
  it('rejects a food claiming to be a system food', async () => {
    const { error } = await clientA.from('food_items').insert(customFoodRow(userA.id, { source: 'system' }))
    expect(error?.code).toBe(RLS_VIOLATION)
  })

  it('rejects a food without an owner (created_by null)', async () => {
    const asSystem = await clientA.from('food_items').insert(customFoodRow(userA.id, { source: 'system', created_by: null }))
    expect(asSystem.error?.code).toBe(RLS_VIOLATION)
    const asCustom = await clientA.from('food_items').insert(customFoodRow(userA.id, { created_by: null }))
    expect(asCustom.error?.code).toBe(RLS_VIOLATION)
  })

  it('rejects a food owned by another user', async () => {
    const { error } = await clientA.from('food_items').insert(customFoodRow(userB.id))
    expect(error?.code).toBe(RLS_VIOLATION)
  })

  it('accepts saved provider foods (usda / off) owned by the caller', async () => {
    const usda = customFoodRow(userA.id, { source: 'usda', external_id: '171477', attribution: 'USDA FoodData Central' })
    const { error } = await clientA.from('food_items').insert(usda)
    expect(error).toBeNull()
    cleanup.track('food_items', rowId(usda))
  })

  it('cannot turn an own custom food into a system food', async () => {
    const { error } = await clientA.from('food_items').update({ source: 'system', created_by: null }).eq('id', rowId(foodOfA))
    expect(error?.code).toBe(RLS_VIOLATION)
  })
})

describe('system foods are read-only', () => {
  it('a signed-in user sees system foods and own foods, never foods of others', async () => {
    const { data } = await clientA.from('food_items').select('id, created_by')
    const ids = new Set(data?.map((row) => row.id))
    expect(ids.has(systemFoodId)).toBe(true)
    expect(ids.has(rowId(foodOfA))).toBe(true)
    expect(ids.has(rowId(foodOfB))).toBe(false)
    expect(data?.every((row) => row.created_by === null || row.created_by === userA.id)).toBe(true)
  })

  it('updating a system food affects 0 rows', async () => {
    const before = await admin.from('food_items').select('*').eq('id', systemFoodId).single()
    const { data, error } = await clientA.from('food_items').update({ name: 'Renamed system food' }).eq('id', systemFoodId).select()
    expect(error).toBeNull()
    expect(data).toEqual([])
    const after = await admin.from('food_items').select('*').eq('id', systemFoodId).single()
    expect(after.data).toEqual(before.data)
  })

  it('deleting a system food affects 0 rows', async () => {
    const { data, error } = await clientA.from('food_items').delete().eq('id', systemFoodId).select('id')
    expect(error).toBeNull()
    expect(data).toEqual([])
    const still = await admin.from('food_items').select('id').eq('id', systemFoodId)
    expect(still.data).toHaveLength(1)
  })

  it('upserting over a system food id is rejected', async () => {
    const { error } = await clientA.from('food_items').upsert(customFoodRow(userA.id, { id: systemFoodId }), { onConflict: 'id' })
    expect(error?.code).toBe(RLS_VIOLATION)
  })
})

describe('references to foods must be visible to the caller', () => {
  it("cannot favorite another user's custom food", async () => {
    const { error } = await clientA.from('favorites').insert(favoriteRow(userA.id, { food_id: rowId(foodOfB) }))
    expect(error?.code).toBe(RLS_VIOLATION)
  })

  it("cannot repoint an own favorite at another user's custom food", async () => {
    const favorite = favoriteRow(userA.id)
    expect((await clientA.from('favorites').insert(favorite)).error).toBeNull()
    cleanup.track('favorites', rowId(favorite))
    const { error } = await clientA.from('favorites').update({ food_id: rowId(foodOfB) }).eq('id', rowId(favorite))
    expect(error?.code).toBe(RLS_VIOLATION)
  })

  it('can favorite a system food and an own custom food', async () => {
    const favorites = [favoriteRow(userA.id), favoriteRow(userA.id, { food_id: rowId(foodOfA) })]
    const { error } = await clientA.from('favorites').insert(favorites)
    expect(error).toBeNull()
    for (const favorite of favorites) cleanup.track('favorites', rowId(favorite))
  })

  it("cannot log a meal referencing another user's custom food", async () => {
    const { error } = await clientA.from('meal_logs').insert(mealLogRow(userA.id, { food_id: rowId(foodOfB) }))
    expect(error?.code).toBe(RLS_VIOLATION)
  })

  it("cannot repoint an own meal log at another user's custom food", async () => {
    const meal = mealLogRow(userA.id, { food_id: rowId(foodOfA) })
    expect((await clientA.from('meal_logs').insert(meal)).error).toBeNull()
    cleanup.track('meal_logs', rowId(meal))
    const { error } = await clientA.from('meal_logs').update({ food_id: rowId(foodOfB) }).eq('id', rowId(meal))
    expect(error?.code).toBe(RLS_VIOLATION)
  })

  it('can log meals referencing a system food, an own food, or no catalog food', async () => {
    const meals = [
      mealLogRow(userA.id, { food_id: systemFoodId, food_source: 'system' }),
      mealLogRow(userA.id, { food_id: rowId(foodOfA) }),
      mealLogRow(userA.id, { food_id: null }),
    ]
    const { error } = await clientA.from('meal_logs').insert(meals)
    expect(error).toBeNull()
    for (const meal of meals) cleanup.track('meal_logs', rowId(meal))
  })

  it('deleting an own custom food keeps logged meals (food_id becomes null)', async () => {
    const food = customFoodRow(userA.id, { name: 'Soon removed' })
    const meal = mealLogRow(userA.id, { food_id: rowId(food) })
    expect((await clientA.from('food_items').insert(food)).error).toBeNull()
    expect((await clientA.from('meal_logs').insert(meal)).error).toBeNull()
    cleanup.track('meal_logs', rowId(meal))
    expect((await clientA.from('food_items').delete().eq('id', rowId(food))).error).toBeNull()
    const stored = await clientA.from('meal_logs').select('food_id, food_name').eq('id', rowId(meal)).single()
    expect(stored.data).toEqual({ food_id: null, food_name: 'Test lentil soup' })
  })
})
