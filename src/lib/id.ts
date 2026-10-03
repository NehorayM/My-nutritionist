/** Random RFC 4122 v4 UUID for new records (client-generated ids make upserts idempotent). */
export function newId(): string {
  return crypto.randomUUID()
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value)
}

/** Namespace for deterministic food ids (UUID v5). Never change: ids are persisted. */
export const FOOD_ID_NAMESPACE = '6f1c3d5e-2b7a-5c48-9e0f-4a1b2c3d4e5f'

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/-/g, '')
  const bytes = new Uint8Array(clean.length / 2)
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16)
  return bytes
}

function bytesToUuid(bytes: Uint8Array): string {
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

/** Deterministic RFC 4122 v5 (SHA-1, name-based) UUID. */
export async function uuidV5(name: string, namespace: string = FOOD_ID_NAMESPACE): Promise<string> {
  const ns = hexToBytes(namespace)
  const nameBytes = new TextEncoder().encode(name)
  const data = new Uint8Array(ns.length + nameBytes.length)
  data.set(ns)
  data.set(nameBytes, ns.length)
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-1', data)).slice(0, 16)
  hash[6] = (hash[6]! & 0x0f) | 0x50
  hash[8] = (hash[8]! & 0x3f) | 0x80
  return bytesToUuid(hash)
}

/**
 * Id for a user's saved copy of a provider food. Deterministic per (user, source, external id)
 * so saving the same provider food twice never creates duplicates, while two users never collide.
 */
export function userFoodId(userId: string, source: string, externalId: string): Promise<string> {
  return uuidV5(`${userId}:${source}:${externalId}`)
}

/** Deterministic favorite id: favoriting the same food twice (even offline on two devices) is idempotent. */
export function favoriteId(userId: string, foodId: string): Promise<string> {
  return uuidV5(`favorite:${userId}:${foodId}`)
}

/** Deterministic id for a bundled system food (must match supabase/migrations seed). */
export function systemFoodId(slug: string): Promise<string> {
  return uuidV5(`system:${slug}`)
}
