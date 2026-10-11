import { randomUUID } from 'node:crypto'
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import { afterAll, afterEach, describe, expect, inject, it } from 'vitest'
import './support/context.ts'
import { createAdminClient, createUserClient } from './support/clients.ts'
import { createCleanup } from './support/cleanup.ts'
import { mealLogRow } from './support/rows.ts'

/** Multi-device sync guarantees enforced by the database (migration 004). */
const { env, userA, userB } = inject('dbTest')
const clientA = createUserClient(env, userA)
const clientB = createUserClient(env, userB)
const admin = createAdminClient(env)
const cleanup = createCleanup(admin)
const channels: { client: SupabaseClient; channel: RealtimeChannel }[] = []

afterEach(async () => {
  for (const { client, channel } of channels.splice(0)) await client.removeChannel(channel)
})
afterAll(() => cleanup.run())

const at = (iso: string) => ({ updated_at: iso, created_at: '2026-10-04T12:00:00Z' })

async function upsertMeal(client: SupabaseClient, row: Record<string, unknown>) {
  return client.from('meal_logs').upsert(row, { onConflict: 'id' }).select('*')
}

describe('delete tombstones', () => {
  it('rejects re-inserting a deleted record with its old (or an older) version', async () => {
    const row = mealLogRow(userA.id, at('2026-10-04T12:30:00Z'))
    cleanup.track('meal_logs', String(row.id))
    expect((await upsertMeal(clientA, row)).error).toBeNull()
    expect((await clientA.from('meal_logs').delete().eq('id', String(row.id))).error).toBeNull()

    for (const version of ['2026-10-04T12:30:00Z', '2026-10-04T12:00:00Z']) {
      const stale = await upsertMeal(clientA, { ...row, updated_at: version })
      expect(stale.error).toBeNull()
      expect(stale.data).toEqual([])
    }
    const { data } = await admin.from('meal_logs').select('id').eq('id', String(row.id))
    expect(data).toEqual([])
  })

  it('accepts a newer version of a deleted record (e.g. Undo)', async () => {
    const row = mealLogRow(userA.id, at('2026-10-04T12:30:00Z'))
    cleanup.track('meal_logs', String(row.id))
    await upsertMeal(clientA, row)
    await clientA.from('meal_logs').delete().eq('id', String(row.id))
    const restored = await upsertMeal(clientA, { ...row, updated_at: '2026-10-04T12:31:00Z' })
    expect(restored.error).toBeNull()
    expect(restored.data).toHaveLength(1)
  })

  it('keeps tombstones out of reach of every API role', async () => {
    for (const client of [clientA, admin]) {
      const { data, error } = await client.schema('private').from('sync_tombstones').select('*')
      expect(data).toBeNull()
      expect(error).not.toBeNull()
    }
  })

  it('does not affect a fresh id', async () => {
    const row = mealLogRow(userA.id, { id: randomUUID(), ...at('2026-10-04T12:30:00Z') })
    cleanup.track('meal_logs', String(row.id))
    expect((await upsertMeal(clientA, row)).data).toHaveLength(1)
  })
})

type Received = { table?: string }[]

/** Joins the private topic `user:<id>` as `client`; resolves with the join status and the messages list. */
async function listen(client: SupabaseClient, token: string, topicUserId: string): Promise<{ status: string; received: Received }> {
  await client.realtime.setAuth(token)
  const received: Received = []
  const channel = client.channel(`user:${topicUserId}`, { config: { private: true } })
  channels.push({ client, channel })
  const status = await new Promise<string>((resolve) => {
    channel.on('broadcast', { event: 'changed' }, (message) => received.push(message.payload as { table?: string }))
    channel.subscribe((state) => {
      if (state !== 'CLOSED') resolve(state)
    })
  })
  return { status, received }
}

const settle = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe('change notifications', () => {
  it('tells a signed-in user which of their tables changed, and nothing about other users', async () => {
    // Realtime may still be starting right after `db reset`: join again until it accepts.
    let joined = await listen(clientA, userA.accessToken, userA.id)
    for (let attempt = 1; attempt < 5 && joined.status !== 'SUBSCRIBED'; attempt += 1) {
      for (const { client, channel } of channels.splice(0)) await client.removeChannel(channel)
      await settle(2000)
      joined = await listen(clientA, userA.accessToken, userA.id)
    }
    const { status, received } = joined
    expect(status).toBe('SUBSCRIBED')

    const other = mealLogRow(userB.id)
    cleanup.track('meal_logs', String(other.id))
    await upsertMeal(clientB, other)
    const own = mealLogRow(userA.id)
    cleanup.track('meal_logs', String(own.id))
    await upsertMeal(clientA, own)

    await expect.poll(() => received.length, { timeout: 8000 }).toBeGreaterThan(0)
    await settle(500)
    expect(received.map((message) => message.table)).toEqual(['meal_logs'])
  })

  it("never delivers another user's topic", async () => {
    const { status, received } = await listen(clientA, userA.accessToken, userB.id)
    const row = mealLogRow(userB.id)
    cleanup.track('meal_logs', String(row.id))
    await upsertMeal(clientB, row)
    await settle(1500)
    expect(received).toEqual([])
    expect(status).not.toBe('SUBSCRIBED')
  })
})
