import { EmailError, type EmailMessage, type EmailSender } from './types.ts'

/**
 * Email providers:
 * - Resend (production): RESEND_API_KEY. Without a verified domain Resend only delivers to the account owner's
 *   address from `onboarding@resend.dev` — set REMINDERS_FROM once a domain is verified.
 * - Mailpit (local development): the local Supabase stack's mail catcher (MAILPIT_URL), viewable at :54324.
 */
export const RESEND_ENDPOINT = 'https://api.resend.com/emails'
export const RESEND_DEFAULT_FROM = 'My-nutritionist <onboarding@resend.dev>'
export const MAILPIT_DEFAULT_FROM = 'My-nutritionist <reminders@my-nutritionist.local>'

type FetchLike = (input: string, init: RequestInit) => Promise<Response>

/** Status codes worth retrying later (rate limits and server problems). */
function retryable(status: number): boolean {
  return status === 408 || status === 429 || status >= 500
}

async function postJson(fetchImpl: FetchLike, url: string, headers: Record<string, string>, body: unknown): Promise<unknown> {
  let response: Response
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    })
  } catch {
    throw new EmailError('email provider unreachable', true)
  }
  if (!response.ok) throw new EmailError(`email provider answered ${response.status}`, retryable(response.status))
  return response.json().catch(() => null)
}

function field(value: unknown, key: string): string | null {
  const found: unknown = typeof value === 'object' && value !== null ? Reflect.get(value, key) : null
  return typeof found === 'string' ? found : null
}

/** "Name <address>" → parts (for providers that want them separately). */
export function parseAddress(from: string): { name: string | null; email: string } {
  const match = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(from)
  return match ? { name: match[1] || null, email: match[2] ?? from } : { name: null, email: from.trim() }
}

export function createResendSender(apiKey: string, from: string | null, fetchImpl: FetchLike): EmailSender {
  return {
    name: 'resend',
    // Resend's default limit is 2 requests per second.
    minIntervalMs: 550,
    async send(message: EmailMessage) {
      const headers: Record<string, string> = { Authorization: `Bearer ${apiKey}` }
      if (message.idempotencyKey) headers['Idempotency-Key'] = message.idempotencyKey
      const reply = await postJson(fetchImpl, RESEND_ENDPOINT, headers, {
        from: from ?? RESEND_DEFAULT_FROM,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
        headers: message.headers,
      })
      return { id: field(reply, 'id') }
    },
  }
}

export function createMailpitSender(baseUrl: string, from: string | null, fetchImpl: FetchLike): EmailSender {
  const sender = parseAddress(from ?? MAILPIT_DEFAULT_FROM)
  return {
    name: 'mailpit',
    minIntervalMs: 0,
    async send(message: EmailMessage) {
      const reply = await postJson(fetchImpl, new URL('/api/v1/send', baseUrl).toString(), {}, {
        From: { Email: sender.email, Name: sender.name ?? '' },
        To: [{ Email: message.to }],
        Subject: message.subject,
        Text: message.text,
        HTML: message.html,
        Headers: message.headers,
      })
      return { id: field(reply, 'ID') }
    },
  }
}

/** Resend when its key is set, otherwise Mailpit when configured, otherwise none (deliveries are skipped). */
export function createEmailSender(
  env: { resendApiKey: string | null; mailpitUrl: string | null; from: string | null },
  fetchImpl: FetchLike,
): EmailSender | null {
  if (env.resendApiKey) return createResendSender(env.resendApiKey, env.from, fetchImpl)
  if (env.mailpitUrl) return createMailpitSender(env.mailpitUrl, env.from, fetchImpl)
  return null
}
