import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import './support/context.ts'
import { createAdminClient, createUserClient } from './support/clients.ts'
import { createCleanup } from './support/cleanup.ts'
import { rowId, TABLE_SPECS, type Row, type TableSpec } from './support/rows.ts'

/** Signed-in users only ever see and change their own rows, on every table. */
const { env, userA, userB } = inject('dbTest')
const clientA = createUserClient(env, userA)
const clientB = createUserClient(env, userB)
const admin = createAdminClient(env)
const cleanup = createCleanup(admin)
const RLS_VIOLATION = '42501'

const rowsOfB = new Map<string, Row>()
const cases = TABLE_SPECS.map((spec) => [spec.table, spec] as const)

function rowOfB(spec: TableSpec): Row {
  const row = rowsOfB.get(spec.table)
  if (!row) throw new Error(`No row of user B for ${spec.table}`)
  return row
}

async function expectUnchanged(spec: TableSpec, row: Row): Promise<void> {
  const { data } = await admin.from(spec.table).select('*').eq('id', rowId(row))
  expect(data).toHaveLength(1)
  for (const key of Object.keys(spec.patch())) expect(data?.[0]?.[key]).toEqual(row[key])
  expect(data?.[0]?.[spec.ownerColumn]).toBe(userB.id)
}

beforeAll(async () => {
  for (const spec of TABLE_SPECS) {
    const row = spec.build(userB.id)
    const { error } = await clientB.from(spec.table).insert(row)
    if (error) throw new Error(`User B could not insert into ${spec.table}: ${error.message}`)
    cleanup.track(spec.table, rowId(row))
    rowsOfB.set(spec.table, row)
  }
})

afterAll(() => cleanup.run())

describe('own rows: full CRUD', () => {
  it.each(cases)('user A creates, reads, updates and deletes own %s', async (table, spec) => {
    const row = spec.build(userA.id)
    const inserted = await clientA.from(table).insert(row).select().single()
    expect(inserted.error).toBeNull()
    expect(inserted.data?.[spec.ownerColumn]).toBe(userA.id)
    cleanup.track(table, rowId(row))

    const read = await clientA.from(table).select('*').eq('id', rowId(row))
    expect(read.data).toHaveLength(1)

    const patch = spec.patch()
    const updated = await clientA.from(table).update(patch).eq('id', rowId(row)).select()
    expect(updated.error).toBeNull()
    expect(updated.data).toHaveLength(1)
    expect(updated.data?.[0]).toMatchObject(patch)

    const deleted = await clientA.from(table).delete().eq('id', rowId(row)).select('id')
    expect(deleted.data).toEqual([{ id: rowId(row) }])
    const gone = await admin.from(table).select('id').eq('id', rowId(row))
    expect(gone.data).toEqual([])
  })
})

describe("other users' rows", () => {
  it.each(cases)('user A cannot read any row of user B in %s', async (table, spec) => {
    const all = await clientA.from(table).select('*')
    expect(all.error).toBeNull()
    expect(all.data?.some((row) => row[spec.ownerColumn] === userB.id)).toBe(false)
    const direct = await clientA.from(table).select('id').eq('id', rowId(rowOfB(spec)))
    expect(direct.data).toEqual([])
  })

  it.each(cases)('user A cannot insert a row owned by user B into %s', async (table, spec) => {
    const { error } = await clientA.from(table).insert(spec.build(userB.id))
    expect(error?.code).toBe(RLS_VIOLATION)
  })

  it.each(cases)("user A's update of user B's %s row changes nothing", async (table, spec) => {
    const target = rowOfB(spec)
    const { data, error } = await clientA.from(table).update(spec.patch()).eq('id', rowId(target)).select()
    expect(error).toBeNull()
    expect(data).toEqual([])
    await expectUnchanged(spec, target)
  })

  it.each(cases)("user A's delete of user B's %s row removes nothing", async (table, spec) => {
    const target = rowOfB(spec)
    const { data, error } = await clientA.from(table).delete().eq('id', rowId(target)).select('id')
    expect(error).toBeNull()
    expect(data).toEqual([])
    await expectUnchanged(spec, target)
  })

  it.each(cases.filter(([table]) => table !== 'profiles'))(
    "user A cannot take over user B's %s row by upserting its id",
    async (table, spec) => {
      const target = rowOfB(spec)
      const hijack = { ...spec.build(userA.id), id: rowId(target) }
      const { error } = await clientA.from(table).upsert(hijack, { onConflict: 'id' })
      expect(error?.code).toBe(RLS_VIOLATION)
      await expectUnchanged(spec, target)
    },
  )
})

describe('ownership cannot be reassigned', () => {
  it.each(cases)('user A cannot change the owner of an own %s row to user B', async (table, spec) => {
    const row = spec.build(userA.id)
    const inserted = await clientA.from(table).insert(row)
    expect(inserted.error).toBeNull()
    cleanup.track(table, rowId(row))
    const moved = await clientA
      .from(table)
      .update({ [spec.ownerColumn]: userB.id })
      .eq('id', rowId(row))
    expect(moved.error?.code).toBe(RLS_VIOLATION)
    const stored = await admin.from(table).select(spec.ownerColumn).eq('id', rowId(row)).single()
    expect(stored.data).toEqual({ [spec.ownerColumn]: userA.id })
    await clientA.from(table).delete().eq('id', rowId(row))
  })
})

describe('profiles', () => {
  it('only accepts a profile whose id is the caller auth.uid()', async () => {
    const stranger = await clientA.from('profiles').insert({ id: randomUUID(), display_name: 'Someone else' })
    expect(stranger.error?.code).toBe(RLS_VIOLATION)
    const otherUser = await clientA.from('profiles').insert({ id: userB.id, display_name: 'Not me' })
    expect(otherUser.error?.code).toBe(RLS_VIOLATION)
    const own = await clientA.from('profiles').insert({ id: userA.id, display_name: 'Me' }).select('id').single()
    expect(own.data).toEqual({ id: userA.id })
    cleanup.track('profiles', userA.id)
  })
})
