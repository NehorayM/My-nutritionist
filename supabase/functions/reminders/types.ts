/** Shared types of the `reminders` Edge Function (runtime-agnostic: tested in Node, deployed on Deno). */
export const REMINDER_KINDS = ['meal_log', 'hydration', 'planning', 'weigh_in'] as const
export type ReminderKind = (typeof REMINDER_KINDS)[number]

/** One claimed reminder, as returned by `public.claim_due_reminders` (migration 006). */
export interface DueReminder {
  dispatchId: string
  scheduleId: string
  userId: string
  email: string
  kind: ReminderKind
  mealType: string | null
  localDate: string
  skipIfLogged: boolean
  alreadyLogged: boolean
}

export type DispatchOutcome = 'sent' | 'skipped' | 'failed'

/** Machine-readable reasons stored in reminder_dispatches.detail (the app turns them into words). */
export type DispatchDetail = 'already_logged' | 'email_not_configured' | 'provider_rejected' | 'provider_unavailable' | 'no_email'

/** Database access of the function (service role). */
export interface ReminderStore {
  claimDue(now: Date): Promise<DueReminder[]>
  markDispatch(id: string, outcome: DispatchOutcome, detail: DispatchDetail | null, providerMessageId: string | null): Promise<void>
  userEmail(userId: string): Promise<string | null>
  /** Turns a schedule (of that user) off; false when there was none. */
  disableSchedule(scheduleId: string, userId: string): Promise<boolean>
  /** Turns every schedule of the user off; returns how many changed. */
  disableAllSchedules(userId: string): Promise<number>
}

export interface EmailMessage {
  to: string
  subject: string
  text: string
  html: string
  headers: Record<string, string>
  /** Same key → the provider sends once, even when a run is retried after a crash. */
  idempotencyKey: string | null
}

/** A failed send: `retryable` for rate limits and outages, false when the provider refused the message. */
export class EmailError extends Error {
  readonly retryable: boolean
  constructor(message: string, retryable: boolean) {
    super(message)
    this.name = 'EmailError'
    this.retryable = retryable
  }
}

export interface EmailSender {
  readonly name: 'resend' | 'mailpit'
  /** Minimum pause between two sends (provider rate limits). */
  readonly minIntervalMs: number
  send(message: EmailMessage): Promise<{ id: string | null }>
}

export type LogFn = (message: string, details?: Record<string, unknown>) => void
