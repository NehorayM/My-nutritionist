import { create } from 'zustand'
import type { MigrationCounts } from '@/services/migration'
import type { SyncStatus } from '@/services/sync'
import type { ConnectionState } from '@/types'

export interface GuestImportOffer {
  guestId: string
  total: number
  counts: MigrationCounts
}

interface SyncStoreState {
  /** Verified reachability of Supabase ('unconfigured' in Offline/Local mode). */
  connection: ConnectionState
  /** Outbox/sync status of the signed-in user; null in guest mode. */
  sync: SyncStatus | null
  /** Guest data on this device that can be imported into the signed-in account. */
  guestImport: GuestImportOffer | null
  importing: boolean
  /** Neutral notice for the welcome/profile screens (e.g. expired session, unusable email link). */
  authNotice: string | null
}

export const useSyncStore = create<SyncStoreState>()(() => ({
  connection: 'checking',
  sync: null,
  guestImport: null,
  importing: false,
  authNotice: null,
}))
