/**
 * Unsubscribe links: `<scheduleId>.<userId>.<signature>` where the signature is HMAC-SHA-256 (base64url) of
 * `<scheduleId>.<userId>` with REMINDERS_SIGNING_KEY. Anyone with the link can turn that reminder (or all of the
 * user's reminders) off — and nothing else; it reveals no email address.
 */
const encoder = new TextEncoder()
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function base64url(bytes: ArrayBuffer): string {
  let binary = ''
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function hmac(key: string, payload: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey('raw', encoder.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return base64url(await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(payload)))
}

/** Constant-time comparison of two strings. */
export function safeEqual(a: string, b: string): boolean {
  const left = encoder.encode(a)
  const right = encoder.encode(b)
  let diff = left.length ^ right.length
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) diff |= (left[i] ?? 0) ^ (right[i] ?? 0)
  return diff === 0
}

export async function signUnsubscribeToken(key: string, scheduleId: string, userId: string): Promise<string> {
  return `${scheduleId}.${userId}.${await hmac(key, `${scheduleId}.${userId}`)}`
}

export async function verifyUnsubscribeToken(key: string, token: string): Promise<{ scheduleId: string; userId: string } | null> {
  const [scheduleId, userId, signature, extra] = token.split('.')
  if (extra !== undefined || !scheduleId || !userId || !signature) return null
  if (!UUID.test(scheduleId) || !UUID.test(userId)) return null
  return safeEqual(signature, await hmac(key, `${scheduleId}.${userId}`)) ? { scheduleId, userId } : null
}
