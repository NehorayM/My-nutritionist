import type { Repositories } from '@/repositories/types'
import type { AuthService } from '@/services/auth'
import type { GuestDataSummary, MigrateGuestDataInput, MigrationResult } from '@/services/migration'
import type { DataEvents } from '@/services/dataEvents'
import type { CloudSync, ConnectivityMonitor } from '@/services/sync'
import type { RemoteChangeSubscriber } from '@/services/sync/realtimeChanges'

/** Everything the session controller touches outside the stores — injectable for tests. */
export interface SessionDeps {
  /** null when Supabase is not configured (Offline/Local mode only). */
  auth: AuthService | null
  connectivity: ConnectivityMonitor
  createCloud: (userId: string) => CloudSync
  createLocal: (userId: string) => Repositories
  guestIds: { getOrCreate(): Promise<string>; peek(): Promise<string | null> }
  countGuestData(guestId: string): Promise<GuestDataSummary>
  migrateGuestData(input: MigrateGuestDataInput): Promise<MigrationResult>
  /** Removes a user's cached records from this device. */
  clearUserData(userId: string): Promise<void>
  /** Whether the user chose guest mode on the welcome screen (remembered across reloads). */
  preferGuest: { get(): boolean; set(value: boolean): void }
  /** Where email links (confirmation, password reset) should return to. */
  redirectUrl(): string
  currentUrl(): string
  now(): Date
  /** "Data changed" signals between tabs and from the server (see services/dataEvents). */
  events: DataEvents
  /** Realtime change notifications for the signed-in user; null without Supabase. */
  remoteChanges: RemoteChangeSubscriber | null
}

export type ActionResult = { ok: true } | { ok: false; message: string }
