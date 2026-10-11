import { readFileSync } from 'node:fs'

/**
 * The local stack's Mailpit (mail catcher) and the local `reminders` function secret, for delivery tests.
 * Both are local-development values: the secret lives in the gitignored supabase/functions/.env.
 */
export const MAILPIT_API = 'http://127.0.0.1:54324/api/v1'

export function localCronSecret(): string {
  let env: string
  try {
    env = readFileSync('supabase/functions/.env', 'utf8')
  } catch {
    throw new Error('supabase/functions/.env is missing: add REMINDERS_CRON_SECRET (see docs/SUPABASE_SETUP.md)')
  }
  const secret = /^REMINDERS_CRON_SECRET=(.+)$/m.exec(env)?.[1]?.trim()
  if (!secret) throw new Error('REMINDERS_CRON_SECRET is not set in supabase/functions/.env')
  return secret
}

export interface MailpitMessage {
  ID: string
  Subject: string
  To: { Address: string }[]
}

export async function messagesTo(address: string): Promise<MailpitMessage[]> {
  const response = await fetch(`${MAILPIT_API}/search?query=${encodeURIComponent(`to:"${address}"`)}`)
  if (!response.ok) throw new Error(`Mailpit search failed (${response.status})`)
  const body = (await response.json()) as { messages?: MailpitMessage[] }
  return body.messages ?? []
}

export async function messageText(id: string): Promise<{ text: string; html: string }> {
  const response = await fetch(`${MAILPIT_API}/message/${id}`)
  const body = (await response.json()) as { Text?: string; HTML?: string }
  return { text: body.Text ?? '', html: body.HTML ?? '' }
}

export async function messageHeaders(id: string): Promise<Record<string, string[]>> {
  const response = await fetch(`${MAILPIT_API}/message/${id}/headers`)
  return (await response.json()) as Record<string, string[]>
}

export async function deleteMessagesTo(address: string): Promise<void> {
  const ids = (await messagesTo(address)).map((message) => message.ID)
  if (ids.length > 0) await fetch(`${MAILPIT_API}/messages`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ IDs: ids }) })
}
