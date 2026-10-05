import { clearUserData } from '@/repositories/local/userData'
import { createLocalRepositories } from '@/repositories'
import { getSupabase, supabaseConfig } from '@/lib/supabase'
import { createAuthService } from '@/services/auth'
import { countGuestData, migrateGuestData } from '@/services/migration'
import { createCloudSync, createConnectivityMonitor } from '@/services/sync'
import { createSessionController, type SessionController } from './controller'
import { getOrCreateGuestId, peekGuestId } from './guestId'
import type { SessionDeps } from './types'

const PREFER_GUEST_KEY = 'mn.preferGuest'

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

function writeFlag(key: string, value: boolean): void {
  try {
    if (value) localStorage.setItem(key, '1')
    else localStorage.removeItem(key)
  } catch {
    // Storage unavailable: the choice simply isn't remembered across reloads.
  }
}

/** Production wiring. The Supabase client and the auth subscription are created in the same tick. */
function createDefaultDeps(): SessionDeps {
  const client = getSupabase()
  const connectivity = createConnectivityMonitor({ config: supabaseConfig })
  return {
    auth: client ? createAuthService(client) : null,
    connectivity,
    createCloud: (userId) => {
      if (!client) throw new Error('Cloud mode requires Supabase configuration')
      return createCloudSync({ client, userId, connectivity })
    },
    createLocal: createLocalRepositories,
    guestIds: { getOrCreate: getOrCreateGuestId, peek: peekGuestId },
    countGuestData,
    migrateGuestData,
    clearUserData,
    preferGuest: { get: () => readFlag(PREFER_GUEST_KEY), set: (value) => writeFlag(PREFER_GUEST_KEY, value) },
    redirectUrl: () => `${window.location.origin}${window.location.pathname}`,
    currentUrl: () => window.location.href,
    now: () => new Date(),
  }
}

let controller: SessionController | null = null

/** The app's session controller (created on first use). UI calls its actions; state lives in the stores. */
export function session(): SessionController {
  controller ??= createSessionController(createDefaultDeps())
  return controller
}

export type { ActionResult } from './types'
export type { SessionController } from './controller'
