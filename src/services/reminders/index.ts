import { supabaseConfig, getSupabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { reminderDispatchSchema } from '@/schemas'
import type { ReminderDispatch } from '@/types'

/**
 * Server side of email reminders (signed-in users): recent deliveries (`reminder_dispatches`, own rows via RLS),
 * a test email, and unsubscribe links. The schedules themselves are synced records (`reminders` repository).
 */
export type DeliveryResult = { ok: true } | { ok: false; message: string }

const FUNCTION = 'reminders'
const NOT_AVAILABLE = 'Email reminders need an account and a connection to the server.'

function rowToDispatch(row: unknown): ReminderDispatch | null {
  if (typeof row !== 'object' || row === null) return null
  const r = row as Record<string, unknown>
  const parsed = reminderDispatchSchema.safeParse({
    id: r.id,
    scheduleId: r.schedule_id,
    localDate: r.local_date,
    dueAt: r.due_at,
    status: r.status,
    detail: r.detail ?? null,
    updatedAt: r.updated_at,
  })
  return parsed.success ? parsed.data : null
}

/** The latest deliveries, newest first (empty without Supabase). */
export async function listRecentDeliveries(limit = 20): Promise<ReminderDispatch[]> {
  const client = getSupabase()
  if (!client) return []
  const { data, error } = await client
    .from('reminder_dispatches')
    .select('id, schedule_id, local_date, due_at, status, detail, updated_at')
    .order('due_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(`Could not load reminder deliveries (${error.code ?? 'error'})`)
  return (data ?? []).flatMap((row) => rowToDispatch(row) ?? [])
}

/** Message of a failed function call, from its JSON body (`{ error }`) when there is one. */
async function failureMessage(error: unknown): Promise<string> {
  const context: unknown = typeof error === 'object' && error !== null ? Reflect.get(error, 'context') : null
  if (context instanceof Response) {
    try {
      const body: unknown = await context.clone().json()
      const message: unknown = typeof body === 'object' && body !== null ? Reflect.get(body, 'error') : null
      if (typeof message === 'string' && message.length > 0) return message
    } catch {
      // Not JSON: fall through to the generic message.
    }
  }
  return 'The test email could not be sent right now. Please try again later.'
}

/** Sends one test email to the signed-in user's address now. */
export async function sendTestEmail(): Promise<DeliveryResult> {
  const client = getSupabase()
  if (!client) return { ok: false, message: NOT_AVAILABLE }
  const { error } = await client.functions.invoke(`${FUNCTION}/test`, { method: 'POST', body: {} })
  if (!error) return { ok: true }
  logger.warn('reminders', 'Test email failed', error)
  return { ok: false, message: await failureMessage(error) }
}

/** Turns off the reminder an email's unsubscribe link belongs to (works without signing in). */
export async function unsubscribe(token: string, scope: 'one' | 'all' = 'one'): Promise<DeliveryResult> {
  if (!supabaseConfig.configured) return { ok: false, message: NOT_AVAILABLE }
  try {
    const response = await fetch(new URL(`/functions/v1/${FUNCTION}/unsubscribe`, supabaseConfig.url), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: supabaseConfig.key },
      body: JSON.stringify({ token, scope }),
    })
    if (response.ok) return { ok: true }
    return { ok: false, message: response.status === 400 ? 'This unsubscribe link is not valid.' : 'Something went wrong. Please try again later.' }
  } catch {
    return { ok: false, message: 'Can’t reach the server right now. Please try again later.' }
  }
}
