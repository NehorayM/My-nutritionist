import { vi } from 'vitest'
import { newId } from '@/lib/id'
import { createLocalRepositories } from '@/repositories'
import type { Repositories } from '@/repositories/types'
import type { AuthEvent, AuthListener, AuthResult, AuthService, AuthSession } from '@/services/auth'
import type { GuestDataSummary, MigrationResult } from '@/services/migration'
import { emptyCounts } from '@/services/migration'
import type { CloudSync, ConnectivityMonitor, SyncStatus } from '@/services/sync'
import type { ConnectionState } from '@/types'
import type { SessionDeps } from '../types'

export function fakeAuth(initial: AuthSession | null = null) {
  let listener: AuthListener | null = null
  let session = initial
  const service: AuthService = {
    getSession: vi.fn<AuthService['getSession']>(async () => ({ ok: true, session })),
    onAuthStateChange: vi.fn<AuthService['onAuthStateChange']>((next) => {
      listener = next
      return () => undefined
    }),
    signUp: vi.fn<AuthService['signUp']>(async () => ({ ok: true, needsConfirmation: true, session: null })),
    signIn: vi.fn<AuthService['signIn']>(async (email) => {
      session = { userId: newId(), email }
      return { ok: true, session }
    }),
    signOut: vi.fn<AuthService['signOut']>(async () => {
      session = null
      return { ok: true }
    }),
    requestPasswordReset: vi.fn<AuthService['requestPasswordReset']>(async () => ({ ok: true })),
    updatePassword: vi.fn<AuthService['updatePassword']>(async () => ({ ok: true })),
    completeRedirect: vi.fn<AuthService['completeRedirect']>(async (): Promise<AuthResult<{ session: AuthSession | null }>> => ({ ok: true, session })),
  }
  return { service, emit: (event: AuthEvent, next: AuthSession | null) => listener?.(event, next) }
}

export function fakeConnectivity(state: ConnectionState = 'connected'): ConnectivityMonitor {
  return {
    getState: () => state,
    verify: vi.fn<ConnectivityMonitor['verify']>(async () => state),
    subscribe: () => () => undefined,
    dispose: () => undefined,
  }
}

export interface FakeCloud extends CloudSync {
  setUnsynced(count: number): void
}

export function fakeCloud(userId: string, accountProfile = false): FakeCloud {
  let unsynced = 0
  const status: SyncStatus = { state: 'idle', pending: 0, failed: 0, lastSyncedAt: null, lastError: null }
  const repositories: Repositories = createLocalRepositories(userId)
  const remote = { ...repositories, profile: { ...repositories.profile, get: async () => (accountProfile ? { userId } : null) } }
  return {
    repositories,
    remote: remote as unknown as Repositories,
    outbox: { counts: async () => ({ pending: unsynced, failed: 0 }) } as unknown as CloudSync['outbox'],
    engine: {
      requestFlush: vi.fn(),
      flushNow: vi.fn(async () => status),
      getStatus: () => status,
      subscribe: () => () => undefined,
      onEvent: () => () => undefined,
      retryFailed: vi.fn(async () => 2),
      discardFailed: vi.fn(async () => 1),
      dispose: vi.fn(),
    },
    dispose: vi.fn(),
    setUnsynced: (count) => {
      unsynced = count
    },
  }
}

export function fakeDeps(overrides: Partial<SessionDeps> = {}) {
  let preferGuest = false
  const guestId = newId()
  const clouds: FakeCloud[] = []
  const guestSummary: GuestDataSummary = { counts: emptyCounts(), total: 0 }
  const deps: SessionDeps = {
    auth: null,
    connectivity: fakeConnectivity('unconfigured'),
    createCloud: (userId) => {
      const cloud = fakeCloud(userId)
      clouds.push(cloud)
      return cloud
    },
    createLocal: createLocalRepositories,
    guestIds: { getOrCreate: async () => guestId, peek: async () => guestId },
    countGuestData: vi.fn(async () => guestSummary),
    migrateGuestData: vi.fn(async (): Promise<MigrationResult> => ({ ok: true, migrated: emptyCounts(), skipped: emptyCounts() })),
    clearUserData: vi.fn(async () => undefined),
    preferGuest: { get: () => preferGuest, set: (value) => (preferGuest = value) },
    redirectUrl: () => 'http://localhost:5173/',
    currentUrl: () => 'http://localhost:5173/',
    now: () => new Date('2026-10-05T08:00:00.000Z'),
    ...overrides,
  }
  return { deps, guestId, clouds, guestSummary, isPreferGuest: () => preferGuest }
}
