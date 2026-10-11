import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, describe, expect, inject, it } from 'vitest'
import './support/context.ts'
import { createAdminClient, createUserClient } from './support/clients.ts'
import { createCleanup } from './support/cleanup.ts'
import { mealLogRow } from './support/rows.ts'

/** Scheduled email reminders (migrations 005/006): validation, claiming due reminders, delivery log access. */
const { env, userA, userB } = inject('dbTest')
const clientA = createUserClient(env, userA)
const clientB = createUserClient(env, userB)
const admin = createAdminClient(env)
const cleanup = createCleanup(admin)

afterEach(() => cleanup.run())
afterAll(() => cleanup.run())

interface Claimed {
  dispatch_id: string
  schedule_id: string
  user_id: string
  email: string
  kind: string
  meal_type: string | null
  local_date: string
  skip_if_logged: boolean
  already_logged: boolean
}

function schedule(overrides: Record<string, unknown> = {}) {
  return {
    id: randomUUID(),
    user_id: userA.id,
    kind: 'hydration',
    meal_type: null,
    local_time: '10:00',
    days: [0, 1, 2, 3, 4, 5, 6],
    timezone: 'Asia/Jerusalem',
    ...overrides,
  }
}

async function addSchedule(overrides: Record<string, unknown> = {}) {
  const row = schedule(overrides)
  const { error } = await clientA.from('reminder_schedules').insert(row)
  if (error) throw new Error(`insert failed: ${error.message}`)
  cleanup.track('reminder_schedules', row.id)
  return row
}

/** Claims due reminders at `now` and returns those of `scheduleIds` (other test files' schedules are ignored). */
async function claim(now: string, scheduleIds: readonly string[], window = 15): Promise<Claimed[]> {
  const { data, error } = await admin.rpc('claim_due_reminders', { p_now: now, p_window_minutes: window })
  if (error) throw new Error(`claim failed: ${error.message}`)
  return ((data ?? []) as Claimed[]).filter((row) => scheduleIds.includes(row.schedule_id))
}

/** What the Edge Function does after a successful send. */
async function markSent(claimed: readonly Claimed[]): Promise<void> {
  for (const row of claimed) await admin.from('reminder_dispatches').update({ status: 'sent' }).eq('id', row.dispatch_id)
}

describe('reminder schedules', () => {
  it('rejects unknown time zones and inconsistent meal reminders', async () => {
    const zone = await clientA.from('reminder_schedules').insert(schedule({ timezone: 'Mars/Olympus' }))
    expect(zone.error?.code).toBe('22023')
    const meal = await clientA.from('reminder_schedules').insert(schedule({ kind: 'meal_log', meal_type: null }))
    expect(meal.error?.code).toBe('23514')
    const days = await clientA.from('reminder_schedules').insert(schedule({ days: [7] }))
    expect(days.error?.code).toBe('23514')
  })

  it('limits each user to 24 reminders', async () => {
    const rows = Array.from({ length: 24 }, (_, i) => schedule({ local_time: `${String(i).padStart(2, '0')}:00` }))
    const { error } = await clientA.from('reminder_schedules').insert(rows)
    expect(error).toBeNull()
    for (const row of rows) cleanup.track('reminder_schedules', row.id)
    const extra = await clientA.from('reminder_schedules').insert(schedule())
    expect(extra.error?.code).toBe('23514')
  })
})

describe('claiming due reminders', () => {
  // 2026-10-12 is a Monday. Jerusalem is UTC+3 then (IDT); New York UTC−4 (EDT).
  it('claims a reminder in its own time zone, within the window, once per local day', async () => {
    const jerusalem = await addSchedule({ local_time: '10:00', timezone: 'Asia/Jerusalem' })
    const newYork = await addSchedule({ local_time: '10:00', timezone: 'America/New_York' })
    const ids = [jerusalem.id, newYork.id]

    expect(await claim('2026-10-12T06:59:00Z', ids)).toEqual([]) // 09:59 in Jerusalem
    const first = await claim('2026-10-12T07:05:00Z', ids) // 10:05 in Jerusalem, 03:05 in New York
    expect(first).toEqual([expect.objectContaining({ schedule_id: jerusalem.id, local_date: '2026-10-12', email: userA.email })])
    expect(await claim('2026-10-12T07:10:00Z', ids)).toEqual([]) // claimed, being sent
    await markSent(first)
    expect(await claim('2026-10-12T07:20:00Z', ids)).toEqual([]) // past the window: nothing new
    expect(await claim('2026-10-12T14:01:00Z', ids)).toEqual([expect.objectContaining({ schedule_id: newYork.id })])
  })

  it('only fires on the chosen weekdays (in local time)', async () => {
    const weekdays = await addSchedule({ local_time: '08:00', days: [1, 2, 3, 4, 5] })
    expect(await claim('2026-10-11T05:01:00Z', [weekdays.id])).toEqual([]) // Sunday 08:01 local
    expect(await claim('2026-10-12T05:01:00Z', [weekdays.id])).toHaveLength(1) // Monday
  })

  it('still sends a late-evening reminder when the run happens just after midnight', async () => {
    const late = await addSchedule({ local_time: '23:55' })
    const claimed = await claim('2026-10-12T21:02:00Z', [late.id]) // 00:02 on Tuesday in Jerusalem
    expect(claimed).toEqual([expect.objectContaining({ local_date: '2026-10-12' })])
  })

  it('reports whether a meal reminder’s meal is already logged that day', async () => {
    const lunch = await addSchedule({ kind: 'meal_log', meal_type: 'lunch', local_time: '12:30' })
    const meal = mealLogRow(userA.id, { log_date: '2026-10-13', meal_type: 'lunch' })
    cleanup.track('meal_logs', String(meal.id))
    await clientA.from('meal_logs').insert(meal)
    const tuesday = await claim('2026-10-13T09:31:00Z', [lunch.id])
    expect(tuesday).toEqual([expect.objectContaining({ kind: 'meal_log', meal_type: 'lunch', already_logged: true, skip_if_logged: true })])
    await markSent(tuesday)
    const wednesday = await claim('2026-10-14T09:31:00Z', [lunch.id])
    expect(wednesday).toEqual([expect.objectContaining({ already_logged: false })])
  })

  it('retries a failed delivery a limited number of times, and never a sent one', async () => {
    const water = await addSchedule({ local_time: '15:00' })
    const [first] = await claim('2026-10-15T12:01:00Z', [water.id])
    if (!first) throw new Error('expected a claim')
    await admin.from('reminder_dispatches').update({ status: 'failed', detail: 'provider_error' }).eq('id', first.dispatch_id)
    expect(await claim('2026-10-15T12:06:00Z', [water.id])).toHaveLength(1) // attempt 2
    await admin.from('reminder_dispatches').update({ status: 'failed' }).eq('id', first.dispatch_id)
    expect(await claim('2026-10-15T12:11:00Z', [water.id])).toHaveLength(1) // attempt 3
    await admin.from('reminder_dispatches').update({ status: 'failed' }).eq('id', first.dispatch_id)
    expect(await claim('2026-10-15T12:16:00Z', [water.id])).toEqual([]) // no 4th attempt
    const { data } = await admin.from('reminder_dispatches').select('attempts').eq('id', first.dispatch_id).single()
    expect(data?.attempts).toBe(3)
  })

  it('takes over a delivery whose run died mid-send, but not a day later', async () => {
    const stuck = await addSchedule({ local_time: '16:00' })
    expect(await claim('2026-10-15T13:01:00Z', [stuck.id])).toHaveLength(1)
    expect(await claim('2026-10-15T13:06:00Z', [stuck.id])).toEqual([]) // still being sent
    expect(await claim('2026-10-15T13:12:00Z', [stuck.id])).toHaveLength(1) // > 10 min: taken over
    expect(await claim('2026-10-16T13:30:00Z', [stuck.id])).toEqual([]) // yesterday's is no longer timely (today's is past its window)
  })

  it('ignores disabled reminders', async () => {
    const off = await addSchedule({ local_time: '18:00', enabled: false })
    expect(await claim('2026-10-16T15:01:00Z', [off.id])).toEqual([])
  })
})

describe('delivery log access', () => {
  it('lets users read only their own deliveries and never write them', async () => {
    const water = await addSchedule({ local_time: '19:00' })
    await claim('2026-10-17T16:01:00Z', [water.id])
    const own = await clientA.from('reminder_dispatches').select('schedule_id, status').eq('schedule_id', water.id)
    expect(own.data).toEqual([{ schedule_id: water.id, status: 'claimed' }])
    const other = await clientB.from('reminder_dispatches').select('id').eq('schedule_id', water.id)
    expect(other.data).toEqual([])
    const forged = await clientA
      .from('reminder_dispatches')
      .insert({ schedule_id: water.id, user_id: userA.id, local_date: '2026-10-18', due_at: '2026-10-18T16:00:00Z', status: 'sent' })
    expect(forged.error?.code).toBe('42501')
    const tampered = await clientA.from('reminder_dispatches').update({ status: 'sent' }).eq('schedule_id', water.id).select()
    expect(tampered.data ?? []).toEqual([])
  })

  it('keeps the claim function away from signed-in users and visitors', async () => {
    const asUser = await clientA.rpc('claim_due_reminders', {})
    expect(asUser.error).not.toBeNull()
    const asAnon = await createUserClient(env, { ...userA, accessToken: env.publishableKey }).rpc('claim_due_reminders', {})
    expect(asAnon.error).not.toBeNull()
  })
})
