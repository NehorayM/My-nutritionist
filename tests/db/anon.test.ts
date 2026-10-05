import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import './support/context.ts'
import { createAdminClient, createAnonClient } from './support/clients.ts'
import { createCleanup } from './support/cleanup.ts'
import { customFoodRow, rowId, TABLE_SPECS, type Row } from './support/rows.ts'
import { readSystemFoodIds } from './support/systemFoods.ts'

/** Signed-out callers (publishable key, role anon) — what any visitor of the deployed app can do. */
const { env, userA } = inject('dbTest')
const anon = createAnonClient(env)
const admin = createAdminClient(env)
const cleanup = createCleanup(admin)
const PERMISSION_DENIED = '42501'

/** One existing row per table, owned by user A and created with the admin client. */
const existing = new Map<string, Row>()

beforeAll(async () => {
  for (const spec of TABLE_SPECS) {
    const row = spec.build(userA.id)
    const { error } = await admin.from(spec.table).insert(row)
    if (error) throw new Error(`Arrange ${spec.table}: ${error.message}`)
    cleanup.track(spec.table, rowId(row))
    existing.set(spec.table, row)
  }
})

afterAll(() => cleanup.run())

function existingRow(table: string): Row {
  const row = existing.get(table)
  if (!row) throw new Error(`No arranged row for ${table}`)
  return row
}

const NON_CATALOG_TABLES = TABLE_SPECS.filter((spec) => spec.table !== 'food_items')

describe('anon on user tables', () => {
  it.each(NON_CATALOG_TABLES.map((spec) => [spec.table, spec] as const))('cannot select %s', async (table) => {
    const { data, error } = await anon.from(table).select('*')
    expect(error?.code).toBe(PERMISSION_DENIED)
    expect(data).toBeNull()
  })

  it.each(NON_CATALOG_TABLES.map((spec) => [spec.table, spec] as const))('cannot insert into %s', async (table, spec) => {
    const { error } = await anon.from(table).insert(spec.build(userA.id))
    expect(error?.code).toBe(PERMISSION_DENIED)
  })

  it.each(NON_CATALOG_TABLES.map((spec) => [spec.table, spec] as const))('cannot update %s', async (table, spec) => {
    const row = existingRow(table)
    const patch = spec.patch()
    const { error } = await anon.from(table).update(patch).eq('id', rowId(row))
    expect(error?.code).toBe(PERMISSION_DENIED)
    const stored = await admin.from(table).select('*').eq('id', rowId(row)).single()
    for (const key of Object.keys(patch)) expect(stored.data?.[key]).toEqual(row[key])
  })

  it.each(NON_CATALOG_TABLES.map((spec) => [spec.table, spec] as const))('cannot delete from %s', async (table) => {
    const row = existingRow(table)
    const { error } = await anon.from(table).delete().eq('id', rowId(row))
    expect(error?.code).toBe(PERMISSION_DENIED)
    const stored = await admin.from(table).select('id').eq('id', rowId(row))
    expect(stored.data).toHaveLength(1)
  })
})

describe('anon on food_items', () => {
  it('reads system foods but never a user custom food', async () => {
    const custom = existingRow('food_items')
    const { data, error } = await anon.from('food_items').select('id, name, created_by').limit(1000)
    expect(error).toBeNull()
    expect(data?.length).toBe(readSystemFoodIds().length)
    expect(data?.some((row) => row.id === custom.id)).toBe(false)
    const direct = await anon.from('food_items').select('id').eq('id', rowId(custom))
    expect(direct.data).toEqual([])
  })

  it('cannot insert a system or custom food', async () => {
    const system = await anon.from('food_items').insert(customFoodRow(userA.id, { source: 'system', created_by: null }))
    expect(system.error?.code).toBe(PERMISSION_DENIED)
    const custom = await anon.from('food_items').insert(customFoodRow(userA.id))
    expect(custom.error?.code).toBe(PERMISSION_DENIED)
  })

  it('cannot update or delete a system food', async () => {
    const systemId = readSystemFoodIds()[0] ?? ''
    const before = await admin.from('food_items').select('name, updated_at').eq('id', systemId).single()
    const updated = await anon.from('food_items').update({ name: 'Changed by anon' }).eq('id', systemId)
    expect(updated.error?.code).toBe(PERMISSION_DENIED)
    const deleted = await anon.from('food_items').delete().eq('id', systemId)
    expect(deleted.error?.code).toBe(PERMISSION_DENIED)
    const after = await admin.from('food_items').select('name, updated_at').eq('id', systemId).single()
    expect(after.data).toEqual(before.data)
  })
})
