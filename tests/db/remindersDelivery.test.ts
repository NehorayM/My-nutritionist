import { randomUUID } from 'node:crypto'
import { afterAll, beforeEach, describe, expect, inject, it } from 'vitest'
import './support/context.ts'
import { createAdminClient, createUserClient } from './support/clients.ts'
import { createCleanup } from './support/cleanup.ts'
import { deleteMessagesTo, localCronSecret, messageHeaders, messagesTo, messageText } from './support/mailpit.ts'
import { mealLogRow } from './support/rows.ts'

/**
 * End to end through the LOCAL stack: reminder schedule (RLS) → `reminders` Edge Function (served by the local
 * edge runtime) → claim in Postgres → email delivered to Mailpit → delivery recorded → unsubscribe link works.
 */
const { env, userA } = inject('dbTest')
const clientA = createUserClient(env, userA)
const admin = createAdminClient(env)
const cleanup = createCleanup(admin)
const functionUrl = `${env.apiUrl}/functions/v1/reminders`

afterAll(() => cleanup.run())
beforeEach(() => deleteMessagesTo(userA.email))

/** A reminder that is due right now (UTC, a minute ago, every day). */
async function dueNow(overrides: Record<string, unknown> = {}) {
  const minuteAgo = new Date(Date.now() - 60_000)
  const row = {
    id: randomUUID(),
    user_id: userA.id,
    kind: 'hydration',
    meal_type: null,
    local_time: minuteAgo.toISOString().slice(11, 16),
    days: [0, 1, 2, 3, 4, 5, 6],
    timezone: 'UTC',
    ...overrides,
  }
  const { error } = await clientA.from('reminder_schedules').insert(row)
  if (error) throw new Error(error.message)
  cleanup.track('reminder_schedules', row.id)
  return row
}

async function runDispatch() {
  const response = await fetch(`${functionUrl}/dispatch`, { method: 'POST', headers: { 'x-reminders-secret': localCronSecret() } })
  expect(response.status).toBe(200)
  return (await response.json()) as { claimed: number; sent: number; skipped: number }
}

async function dispatchOf(scheduleId: string) {
  const { data } = await clientA.from('reminder_dispatches').select('status, detail').eq('schedule_id', scheduleId)
  return data ?? []
}

describe('scheduled reminder delivery (local Edge Function + Mailpit)', () => {
  it('emails a due reminder exactly once and records it as sent', async () => {
    const schedule = await dueNow()
    await runDispatch()
    await expect.poll(async () => (await messagesTo(userA.email)).length, { timeout: 10_000 }).toBe(1)
    const [message] = await messagesTo(userA.email)
    expect(message?.Subject).toBe('A gentle reminder to drink some water')
    expect(await dispatchOf(schedule.id)).toEqual([{ status: 'sent', detail: null }])
    const headers = await messageHeaders(message?.ID ?? '')
    expect(headers['List-Unsubscribe-Post']).toEqual(['List-Unsubscribe=One-Click'])

    await runDispatch()
    expect(await messagesTo(userA.email)).toHaveLength(1)
  })

  it('skips a meal reminder when that meal is already logged today', async () => {
    const today = new Date().toISOString().slice(0, 10)
    const meal = mealLogRow(userA.id, { log_date: today, meal_type: 'dinner' })
    cleanup.track('meal_logs', String(meal.id))
    await clientA.from('meal_logs').insert(meal)
    const schedule = await dueNow({ kind: 'meal_log', meal_type: 'dinner' })
    await runDispatch()
    expect(await dispatchOf(schedule.id)).toEqual([{ status: 'skipped', detail: 'already_logged' }])
    expect(await messagesTo(userA.email)).toEqual([])
  })

  it('turns the reminder off from the link in the email', async () => {
    const schedule = await dueNow({ kind: 'planning' })
    await runDispatch()
    await expect.poll(async () => (await messagesTo(userA.email)).length, { timeout: 10_000 }).toBe(1)
    const [message] = await messagesTo(userA.email)
    const { text } = await messageText(message?.ID ?? '')
    const token = decodeURIComponent(/#\/unsubscribe\?token=([^\s]+)/.exec(text)?.[1] ?? '')
    expect(token).not.toBe('')
    const response = await fetch(`${functionUrl}/unsubscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: env.publishableKey },
      body: JSON.stringify({ token }),
    })
    expect(response.status).toBe(200)
    const { data } = await clientA.from('reminder_schedules').select('enabled').eq('id', schedule.id).single()
    expect(data?.enabled).toBe(false)
  })

  it('sends a test email to a signed-in user', async () => {
    const response = await fetch(`${functionUrl}/test`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userA.accessToken}`, apikey: env.publishableKey },
    })
    expect(response.status).toBe(200)
    await expect.poll(async () => (await messagesTo(userA.email)).map((m) => m.Subject), { timeout: 10_000 }).toEqual(['Your reminders are set up'])
    const anonymous = await fetch(`${functionUrl}/test`, { method: 'POST', headers: { apikey: env.publishableKey } })
    expect(anonymous.status).toBe(401)
  })
})
