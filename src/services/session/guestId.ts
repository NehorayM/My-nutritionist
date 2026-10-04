import { newId, isUuid } from '@/lib/id'
import { logger } from '@/lib/logger'
import { readMeta, writeMeta } from '@/repositories/local/meta'

const STORAGE_KEY = 'mn.guestId'
const META_KEY = 'guestId'

function readLocalStorage(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function writeLocalStorage(id: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, id)
  } catch {
    logger.warn('session', 'localStorage unavailable; guest id kept in IndexedDB only')
  }
}

/**
 * Stable id that owns this device's guest data. Stored in localStorage with an IndexedDB copy,
 * so guest data stays reachable if either store is cleared independently.
 */
export async function getOrCreateGuestId(): Promise<string> {
  const fromStorage = readLocalStorage()
  if (fromStorage && isUuid(fromStorage)) {
    await writeMeta(META_KEY, fromStorage).catch(() => undefined)
    return fromStorage
  }
  const fromMeta = await readMeta(META_KEY).catch(() => undefined)
  const id = typeof fromMeta === 'string' && isUuid(fromMeta) ? fromMeta : newId()
  writeLocalStorage(id)
  await writeMeta(META_KEY, id).catch((error: unknown) => logger.warn('session', 'Could not persist guest id', error))
  return id
}

/** The current device's guest id without creating one (null when this device never used guest mode). */
export async function peekGuestId(): Promise<string | null> {
  const fromStorage = readLocalStorage()
  if (fromStorage && isUuid(fromStorage)) return fromStorage
  const fromMeta = await readMeta(META_KEY).catch(() => undefined)
  return typeof fromMeta === 'string' && isUuid(fromMeta) ? fromMeta : null
}
