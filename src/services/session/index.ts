import { clearUserData } from '@/repositories/local/userData'
import { createLocalRepositories } from '@/repositories/local'
import { getSupabase, supabaseConfig } from '@/lib/supabase'
import { createConnectivityMonitor } from '@/services/sync/connectivity'
import { createSessionController, type SessionController } from './controller'
import { getOrCreateGuestId, peekGuestId } from './guestId'
import type { SessionDeps } from './types'

const PREFER_GUEST_KEY = 'mn.preferGuest'
const CLOUD_ONLY = 'Cloud mode is not configured'

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

/** Dependencies for Offline/Local mode; the cloud-only ones are replaced when Supabase is available. */
function createLocalDeps(): SessionDeps {
  return {
    auth: null,
    connectivity: createConnectivityMonitor({ config: supabaseConfig }),
    createCloud: () => {
      throw new Error(CLOUD_ONLY)
    },
    createLocal: createLocalRepositories,
    guestIds: { getOrCreate: getOrCreateGuestId, peek: peekGuestId },
    countGuestData: () => Promise.reject(new Error(CLOUD_ONLY)),
    migrateGuestData: () => Promise.reject(new Error(CLOUD_ONLY)),
    clearUserData,
    preferGuest: { get: () => readFlag(PREFER_GUEST_KEY), set: (value) => writeFlag(PREFER_GUEST_KEY, value) },
    redirectUrl: () => `${window.location.origin}${window.location.pathname}`,
    currentUrl: () => window.location.href,
    now: () => new Date(),
  }
}

let controller: SessionController | null = null

/**
 * Creates the session controller once the Supabase client is loaded (see startSession). With a client, the
 * cloud modules are imported on demand and the auth service is created in the same task as the subscription.
 */
export async function initSession(): Promise<SessionController> {
  if (controller) return controller
  const deps = createLocalDeps()
  const client = getSupabase()
  if (client) {
    const { createCloudDeps } = await import('./cloudDeps')
    Object.assign(deps, createCloudDeps(client, deps.connectivity))
  }
  controller ??= createSessionController(deps)
  return controller
}

/** The app's session controller. UI calls its actions; state lives in the stores. */
export function session(): SessionController {
  // Before initSession (only possible without Supabase, e.g. in tests) the local controller is complete.
  controller ??= createSessionController(createLocalDeps())
  return controller
}

export type { ActionResult } from './types'
export type { SessionController } from './controller'
