import type { SupabaseClient } from '@supabase/supabase-js'
import { createAuthService } from '@/services/auth'
import { countGuestData, migrateGuestData } from '@/services/migration'
import { createCloudSync } from '@/services/sync/cloudSync'
import type { ConnectivityMonitor } from '@/services/sync/connectivity'
import type { SessionDeps } from './types'

/** Cloud-mode dependencies. Loaded with a dynamic import, so Offline/Local mode never downloads them. */
export function createCloudDeps(
  client: SupabaseClient,
  connectivity: ConnectivityMonitor,
): Pick<SessionDeps, 'auth' | 'createCloud' | 'countGuestData' | 'migrateGuestData'> {
  return {
    auth: createAuthService(client),
    createCloud: (userId) => createCloudSync({ client, userId, connectivity }),
    countGuestData,
    migrateGuestData,
  }
}
