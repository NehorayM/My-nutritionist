import { afterAll, describe, expect, inject, it } from 'vitest'
import './support/context.ts'
import { createAdminClient } from './support/clients.ts'
import { deleteUsers } from './support/globalSetup.ts'
import { customFoodRow, favoriteRow, mealLogRow, rowId, TABLE_SPECS } from './support/rows.ts'

/** Deleting an account removes every row the user owns (GDPR-style erasure through FK cascades). */
const { env } = inject('dbTest')
const admin = createAdminClient(env)
const createdUserIds: string[] = []

afterAll(async () => {
  const leftovers = []
  for (const id of createdUserIds) {
    const { data } = await admin.auth.admin.getUserById(id)
    if (data.user) leftovers.push(id)
  }
  if (leftovers.length > 0) await deleteUsers(env, leftovers)
})

describe('deleting a user', () => {
  it('cascades to all of their rows and leaves the system catalog intact', async () => {
    const created = await admin.auth.admin.createUser({
      email: `db-test-cascade-${crypto.randomUUID()}@my-nutritionist.test`,
      password: `pw-${crypto.randomUUID()}`,
      email_confirm: true,
    })
    expect(created.error).toBeNull()
    const userId = created.data.user?.id ?? ''
    createdUserIds.push(userId)

    const food = customFoodRow(userId)
    const rows = [
      ...TABLE_SPECS.map((spec) => [spec, spec.build(userId)] as const),
      [TABLE_SPECS.find((spec) => spec.table === 'favorites'), favoriteRow(userId, { food_id: rowId(food) })] as const,
      [TABLE_SPECS.find((spec) => spec.table === 'meal_logs'), mealLogRow(userId, { food_id: rowId(food) })] as const,
    ]
    expect((await admin.from('food_items').insert(food)).error).toBeNull()
    for (const [spec, row] of rows) {
      if (!spec) throw new Error('Missing table spec')
      const { error } = await admin.from(spec.table).insert(row)
      expect(error).toBeNull()
    }
    const systemCountBefore = await admin.from('food_items').select('id', { count: 'exact', head: true }).is('created_by', null)

    const deleted = await admin.auth.admin.deleteUser(userId)
    expect(deleted.error).toBeNull()

    for (const spec of TABLE_SPECS) {
      const { count, error } = await admin
        .from(spec.table)
        .select('id', { count: 'exact', head: true })
        .eq(spec.ownerColumn, userId)
      expect(error).toBeNull()
      expect({ table: spec.table, count }).toEqual({ table: spec.table, count: 0 })
    }
    const systemCountAfter = await admin.from('food_items').select('id', { count: 'exact', head: true }).is('created_by', null)
    expect(systemCountAfter.count).toBe(systemCountBefore.count)
  })
})
