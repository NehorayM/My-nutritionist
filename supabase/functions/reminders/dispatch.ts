import { reminderEmail } from './email.ts'
import { signUnsubscribeToken } from './token.ts'
import { EmailError, type DueReminder, type EmailSender, type LogFn, type ReminderStore } from './types.ts'

export interface DispatchDeps {
  store: ReminderStore
  sender: EmailSender | null
  signingKey: string
  appUrl: string
  /** Public URL of this function (for one-click unsubscribe headers); null to omit them. */
  functionUrl: string | null
  now: () => Date
  sleep: (ms: number) => Promise<void>
  log: LogFn
}

export interface DispatchSummary {
  claimed: number
  sent: number
  skipped: number
  failed: number
}

/** The links and headers that let a recipient turn one reminder off. */
export async function unsubscribeLinks(deps: Pick<DispatchDeps, 'signingKey' | 'appUrl' | 'functionUrl'>, scheduleId: string, userId: string) {
  const token = await signUnsubscribeToken(deps.signingKey, scheduleId, userId)
  const pageUrl = `${deps.appUrl}#/unsubscribe?token=${encodeURIComponent(token)}`
  const headers: Record<string, string> = deps.functionUrl
    ? {
        'List-Unsubscribe': `<${deps.functionUrl}/unsubscribe?token=${encodeURIComponent(token)}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      }
    : {}
  return { pageUrl, headers }
}

async function deliver(deps: DispatchDeps, due: DueReminder): Promise<'sent' | 'skipped' | 'failed'> {
  const { store, sender, log } = deps
  if (due.kind === 'meal_log' && due.skipIfLogged && due.alreadyLogged) {
    await store.markDispatch(due.dispatchId, 'skipped', 'already_logged', null)
    return 'skipped'
  }
  if (!due.email) {
    await store.markDispatch(due.dispatchId, 'skipped', 'no_email', null)
    return 'skipped'
  }
  if (!sender) {
    await store.markDispatch(due.dispatchId, 'skipped', 'email_not_configured', null)
    return 'skipped'
  }
  const links = await unsubscribeLinks(deps, due.scheduleId, due.userId)
  const content = reminderEmail({ kind: due.kind, mealType: due.mealType, appUrl: deps.appUrl, unsubscribeUrl: links.pageUrl })
  try {
    const { id } = await sender.send({ to: due.email, ...content, headers: links.headers, idempotencyKey: `reminder-${due.dispatchId}` })
    await store.markDispatch(due.dispatchId, 'sent', null, id)
    return 'sent'
  } catch (error) {
    const retry = error instanceof EmailError ? error.retryable : true
    log('send_failed', { provider: sender.name, retryable: retry, error: error instanceof Error ? error.message : 'unknown' })
    // Retryable problems are retried by later runs (up to 3 attempts); a refused message is not.
    await store.markDispatch(due.dispatchId, retry ? 'failed' : 'skipped', retry ? 'provider_unavailable' : 'provider_rejected', null)
    return retry ? 'failed' : 'skipped'
  }
}

/** One scheduled run: claims what is due (idempotent per reminder and day) and sends it, one at a time. */
export async function runDispatch(deps: DispatchDeps): Promise<DispatchSummary> {
  const due = await deps.store.claimDue(deps.now())
  const summary: DispatchSummary = { claimed: due.length, sent: 0, skipped: 0, failed: 0 }
  for (const [index, reminder] of due.entries()) {
    if (index > 0 && deps.sender && deps.sender.minIntervalMs > 0) await deps.sleep(deps.sender.minIntervalMs)
    try {
      summary[await deliver(deps, reminder)] += 1
    } catch (error) {
      // Recording the outcome failed: the claim times out and a later run retries it.
      summary.failed += 1
      deps.log('dispatch_record_failed', { error: error instanceof Error ? error.message : 'unknown' })
    }
  }
  return summary
}
