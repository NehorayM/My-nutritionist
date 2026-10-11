import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { REMINDER_KINDS, type DueReminder, type ReminderKind, type ReminderStore } from './types.ts'

/** Claimed per run; the rest is claimed by the next run (every 5 minutes, within each reminder's window). */
export const CLAIM_LIMIT = 100
export const CLAIM_WINDOW_MINUTES = 15

function isKind(value: unknown): value is ReminderKind {
  return typeof value === 'string' && (REMINDER_KINDS as readonly string[]).includes(value)
}

/** A row of `claim_due_reminders` → `DueReminder` (null when malformed). */
export function toDueReminder(row: unknown): DueReminder | null {
  if (typeof row !== 'object' || row === null) return null
  const r = row as Record<string, unknown>
  const text = (key: string) => (typeof r[key] === 'string' ? (r[key] as string) : null)
  const dispatchId = text('dispatch_id')
  const scheduleId = text('schedule_id')
  const userId = text('user_id')
  const localDate = text('local_date')
  if (!dispatchId || !scheduleId || !userId || !localDate || !isKind(r.kind)) return null
  return {
    dispatchId,
    scheduleId,
    userId,
    email: text('email') ?? '',
    kind: r.kind,
    mealType: text('meal_type'),
    localDate,
    skipIfLogged: r.skip_if_logged === true,
    alreadyLogged: r.already_logged === true,
  }
}

/** Database access with the project's secret key (service role): only inside this function. */
export function createSupabaseReminderStore(client: SupabaseClient): ReminderStore {
  return {
    async claimDue(now) {
      const { data, error } = await client.rpc('claim_due_reminders', {
        p_now: now.toISOString(),
        p_window_minutes: CLAIM_WINDOW_MINUTES,
        p_limit: CLAIM_LIMIT,
      })
      if (error) throw new Error(`claim_due_reminders failed (${error.code ?? 'error'})`)
      return ((data ?? []) as unknown[]).flatMap((row) => toDueReminder(row) ?? [])
    },
    async markDispatch(id, outcome, detail, providerMessageId) {
      const { error } = await client
        .from('reminder_dispatches')
        .update({ status: outcome, detail, provider_message_id: providerMessageId, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw new Error(`marking a dispatch failed (${error.code ?? 'error'})`)
    },
    async userEmail(userId) {
      const { data, error } = await client.auth.admin.getUserById(userId)
      if (error) return null
      return data.user?.email ?? null
    },
    async disableSchedule(scheduleId, userId) {
      const { data, error } = await client
        .from('reminder_schedules')
        .update({ enabled: false, updated_at: new Date().toISOString() })
        .eq('id', scheduleId)
        .eq('user_id', userId)
        .select('id')
      if (error) throw new Error(`disabling a reminder failed (${error.code ?? 'error'})`)
      return (data ?? []).length > 0
    },
    async disableAllSchedules(userId) {
      const { data, error } = await client
        .from('reminder_schedules')
        .update({ enabled: false, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('enabled', true)
        .select('id')
      if (error) throw new Error(`disabling reminders failed (${error.code ?? 'error'})`)
      return (data ?? []).length
    },
  }
}

export function createServiceClient(url: string, secretKey: string): SupabaseClient {
  return createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
}
