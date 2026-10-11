import { describe, expect, it, vi } from 'vitest'
import { createRemindersHandler, routeOf, type RemindersDeps } from '../../../../supabase/functions/reminders/handler.ts'
import { signUnsubscribeToken } from '../../../../supabase/functions/reminders/token.ts'
import { EmailError } from '../../../../supabase/functions/reminders/types.ts'
import { due, fakeSender, fakeStore, SCHEDULE, USER } from './fakes.ts'

const SECRET = 'cron-secret-0123456789abcdef'
const KEY = 'signing-key-0123456789abcdef'
const BASE = 'http://localhost:54321/functions/v1/reminders'

function setup(overrides: Partial<RemindersDeps> = {}, claimed = [due()]) {
  const { store, marks } = fakeStore(claimed)
  const sender = fakeSender()
  const log = vi.fn<RemindersDeps['log']>()
  let now = Date.parse('2026-10-12T09:31:00Z')
  const deps: RemindersDeps = {
    cronSecret: SECRET,
    signingKey: KEY,
    appUrl: 'https://example.org/app/',
    functionUrl: BASE,
    verifyUser: async (header) => (header === 'Bearer user-jwt' ? USER : null),
    store,
    sender,
    now: () => new Date(now),
    sleep: async () => undefined,
    log,
    ...overrides,
  }
  return { handler: createRemindersHandler(deps), store, marks, sender, log, advance: (ms: number) => (now += ms) }
}

const post = (route: string, init: RequestInit = {}) => new Request(`${BASE}/${route}`, { method: 'POST', ...init })

describe('reminders function: routing', () => {
  it('finds the route after the function name', () => {
    expect(routeOf(new URL(`${BASE}/dispatch`))).toBe('dispatch')
    expect(routeOf(new URL('http://x/reminders/unsubscribe?token=1'))).toBe('unsubscribe')
  })

  it('answers CORS preflights and rejects other methods and routes', async () => {
    const { handler } = setup()
    expect((await handler(new Request(`${BASE}/test`, { method: 'OPTIONS' }))).status).toBe(200)
    expect((await handler(new Request(`${BASE}/test`, { method: 'GET' }))).status).toBe(405)
    expect((await handler(post('nope'))).status).toBe(404)
  })
})

describe('reminders function: dispatch', () => {
  it('requires the cron secret', async () => {
    const { handler, store } = setup()
    expect((await handler(post('dispatch'))).status).toBe(401)
    expect((await handler(post('dispatch', { headers: { 'x-reminders-secret': 'wrong' } }))).status).toBe(401)
    expect(store.claimDue).not.toHaveBeenCalled()
  })

  it('sends due reminders with unsubscribe headers and records the outcome', async () => {
    const { handler, marks, sender } = setup()
    const response = await handler(post('dispatch', { headers: { 'x-reminders-secret': SECRET } }))
    expect(await response.json()).toEqual({ claimed: 1, sent: 1, skipped: 0, failed: 0 })
    expect(sender.sent).toHaveLength(1)
    const [message] = sender.sent
    expect(message).toMatchObject({ to: 'noa@example.com', subject: 'Time to log your lunch', idempotencyKey: `reminder-${due().dispatchId}` })
    const token = await signUnsubscribeToken(KEY, SCHEDULE, USER)
    expect(message?.headers['List-Unsubscribe']).toBe(`<${BASE}/unsubscribe?token=${encodeURIComponent(token)}>`)
    expect(message?.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click')
    expect(message?.text).toContain(`#/unsubscribe?token=${encodeURIComponent(token)}`)
    expect(marks).toEqual([{ id: due().dispatchId, outcome: 'sent', detail: null, providerMessageId: 'msg-1' }])
  })

  it('skips meal reminders for meals already logged, and everything without a provider', async () => {
    const logged = setup({}, [due({ alreadyLogged: true }), due({ dispatchId: 'd2', alreadyLogged: true, skipIfLogged: false })])
    await logged.handler(post('dispatch', { headers: { 'x-reminders-secret': SECRET } }))
    expect(logged.marks.map((m) => [m.outcome, m.detail])).toEqual([['skipped', 'already_logged'], ['sent', null]])

    const unconfigured = setup({ sender: null }, [due({ kind: 'hydration', mealType: null })])
    const body = await (await unconfigured.handler(post('dispatch', { headers: { 'x-reminders-secret': SECRET } }))).json()
    expect(body).toMatchObject({ skipped: 1, sent: 0 })
    expect(unconfigured.marks[0]).toMatchObject({ outcome: 'skipped', detail: 'email_not_configured' })
  })

  it('marks provider outages for retry and refusals as skipped', async () => {
    const outage = setup({ sender: fakeSender(new EmailError('503', true)) })
    await outage.handler(post('dispatch', { headers: { 'x-reminders-secret': SECRET } }))
    expect(outage.marks[0]).toMatchObject({ outcome: 'failed', detail: 'provider_unavailable' })
    const refused = setup({ sender: fakeSender(new EmailError('403', false)) })
    await refused.handler(post('dispatch', { headers: { 'x-reminders-secret': SECRET } }))
    expect(refused.marks[0]).toMatchObject({ outcome: 'skipped', detail: 'provider_rejected' })
  })

  it('reports a missing server configuration', async () => {
    const { handler } = setup({ store: null })
    expect((await handler(post('dispatch', { headers: { 'x-reminders-secret': SECRET } }))).status).toBe(503)
  })
})

describe('reminders function: test email', () => {
  it('needs a signed-in user and sends at most one test email a minute', async () => {
    const { handler, sender, advance } = setup()
    expect((await handler(post('test'))).status).toBe(401)
    const auth = { headers: { Authorization: 'Bearer user-jwt' } }
    expect((await handler(post('test', auth))).status).toBe(200)
    expect(sender.sent[0]).toMatchObject({ to: 'noa@example.com', subject: 'Your reminders are set up' })
    expect((await handler(post('test', auth))).status).toBe(429)
    advance(61_000)
    expect((await handler(post('test', auth))).status).toBe(200)
  })

  it('explains when email is not set up on the server', async () => {
    const { handler } = setup({ sender: null })
    const response = await handler(post('test', { headers: { Authorization: 'Bearer user-jwt' } }))
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: expect.stringMatching(/isn’t set up/) })
  })
})

describe('reminders function: unsubscribe', () => {
  it('turns off the reminder of a valid link (JSON body or one-click query)', async () => {
    const { handler, store } = setup()
    const token = await signUnsubscribeToken(KEY, SCHEDULE, USER)
    expect((await handler(post('unsubscribe', { body: JSON.stringify({ token }) }))).status).toBe(200)
    expect(store.disableSchedule).toHaveBeenCalledWith(SCHEDULE, USER)
    const oneClick = await handler(post(`unsubscribe?token=${encodeURIComponent(token)}`, { body: 'List-Unsubscribe=One-Click' }))
    expect(oneClick.status).toBe(200)
  })

  it('can turn off every reminder of the user', async () => {
    const { handler, store } = setup()
    const token = await signUnsubscribeToken(KEY, SCHEDULE, USER)
    const response = await handler(post('unsubscribe', { body: JSON.stringify({ token, scope: 'all' }) }))
    expect(await response.json()).toEqual({ ok: true, disabled: 3 })
    expect(store.disableAllSchedules).toHaveBeenCalledWith(USER)
  })

  it('rejects invalid links without touching anything', async () => {
    const { handler, store } = setup()
    const forged = await signUnsubscribeToken('other-key', SCHEDULE, USER)
    expect((await handler(post('unsubscribe', { body: JSON.stringify({ token: forged }) }))).status).toBe(400)
    expect((await handler(post('unsubscribe', { body: 'not json' }))).status).toBe(400)
    expect(store.disableSchedule).not.toHaveBeenCalled()
  })
})
