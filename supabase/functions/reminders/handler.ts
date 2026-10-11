import { corsHeaders } from '@supabase/supabase-js/cors'
import type { VerifyUser } from '../_shared/auth.ts'
import { runDispatch, type DispatchDeps } from './dispatch.ts'
import { reminderEmail } from './email.ts'
import { safeEqual, verifyUnsubscribeToken } from './token.ts'
import type { EmailSender, LogFn, ReminderStore } from './types.ts'

/**
 * `reminders` Edge Function (verify_jwt = false; every route authenticates itself):
 * - POST /reminders/dispatch     pg_cron, header `x-reminders-secret` → claim and send due reminders
 * - POST /reminders/test         signed-in user (Bearer JWT) → one test email to their address (1 per minute)
 * - POST /reminders/unsubscribe  signed link token (JSON `{ token, scope }` or `?token=` for one-click) → turn off
 */
export interface RemindersDeps {
  cronSecret: string | null
  signingKey: string | null
  appUrl: string
  functionUrl: string | null
  verifyUser: VerifyUser | null
  store: ReminderStore | null
  sender: EmailSender | null
  now: () => Date
  sleep: (ms: number) => Promise<void>
  log: LogFn
}

const TEST_EMAIL_INTERVAL_MS = 60_000
const HEADERS = { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: HEADERS })
}

const fail = (status: number, message: string) => json(status, { error: message })

/** The route after the function name: "/functions/v1/reminders/test" → "test". */
export function routeOf(url: URL): string {
  const parts = url.pathname.split('/').filter(Boolean)
  const at = parts.lastIndexOf('reminders')
  return at >= 0 ? parts.slice(at + 1).join('/') : (parts.at(-1) ?? '')
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await request.json()
    return typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

export function createRemindersHandler(deps: RemindersDeps): (request: Request) => Promise<Response> {
  const lastTest = new Map<string, number>()

  async function dispatch(request: Request): Promise<Response> {
    const secret = request.headers.get('x-reminders-secret') ?? ''
    if (!deps.cronSecret || !safeEqual(secret, deps.cronSecret)) return fail(401, 'Not allowed.')
    if (!deps.store || !deps.signingKey) return fail(503, 'Reminders are not configured on the server.')
    const summary = await runDispatch({ ...deps, store: deps.store, signingKey: deps.signingKey } satisfies DispatchDeps)
    deps.log('dispatch_done', { ...summary, provider: deps.sender?.name ?? 'none' })
    return json(200, summary)
  }

  async function test(request: Request): Promise<Response> {
    const userId = deps.verifyUser ? await deps.verifyUser(request.headers.get('Authorization')) : null
    if (!userId) return fail(401, 'Please sign in again.')
    if (!deps.store) return fail(503, 'Reminders are not configured on the server.')
    if (!deps.sender) return fail(503, 'Email delivery isn’t set up on the server yet.')
    const now = deps.now().getTime()
    const previous = lastTest.get(userId)
    if (previous !== undefined && now - previous < TEST_EMAIL_INTERVAL_MS) return fail(429, 'A test email was just sent. Please wait a minute.')
    const email = await deps.store.userEmail(userId)
    if (!email) return fail(400, 'Your account has no email address.')
    lastTest.set(userId, now)
    try {
      await deps.sender.send({ to: email, ...reminderEmail({ kind: 'test', mealType: null, appUrl: deps.appUrl, unsubscribeUrl: null }), headers: {}, idempotencyKey: null })
      return json(200, { ok: true })
    } catch (error) {
      lastTest.delete(userId)
      deps.log('test_send_failed', { provider: deps.sender.name, error: error instanceof Error ? error.message : 'unknown' })
      return fail(502, 'The email service didn’t accept the test email. Please try again later.')
    }
  }

  async function unsubscribe(request: Request, url: URL): Promise<Response> {
    if (!deps.store || !deps.signingKey) return fail(503, 'Reminders are not configured on the server.')
    const queryToken = url.searchParams.get('token')
    const body = queryToken ? {} : await readJson(request)
    const token = queryToken ?? (typeof body.token === 'string' ? body.token : '')
    const verified = await verifyUnsubscribeToken(deps.signingKey, token)
    if (!verified) return fail(400, 'This unsubscribe link is not valid.')
    if (body.scope === 'all') {
      const count = await deps.store.disableAllSchedules(verified.userId)
      return json(200, { ok: true, disabled: count })
    }
    await deps.store.disableSchedule(verified.scheduleId, verified.userId)
    return json(200, { ok: true, disabled: 1 })
  }

  return async (request) => {
    if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
    if (request.method !== 'POST') return fail(405, 'Use POST.')
    const url = new URL(request.url)
    try {
      switch (routeOf(url)) {
        case 'dispatch':
          return await dispatch(request)
        case 'test':
          return await test(request)
        case 'unsubscribe':
          return await unsubscribe(request, url)
        default:
          return fail(404, 'Not found.')
      }
    } catch (error) {
      deps.log('unexpected_error', { error: error instanceof Error ? error.message : 'unknown' })
      return fail(500, 'Something went wrong. Please try again later.')
    }
  }
}
