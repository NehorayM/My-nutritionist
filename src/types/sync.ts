/** Database tables that hold user-owned, synchronizable records. */
export const SYNC_ENTITIES = [
  'profiles',
  'food_items',
  'meal_logs',
  'weight_logs',
  'workout_logs',
  'scheduled_workouts',
  'favorites',
  'saved_meals',
] as const
export type SyncEntity = (typeof SYNC_ENTITIES)[number]

export type MutationOp = 'upsert' | 'delete'

/** A queued local change waiting to be applied to Supabase. */
export interface OutboxMutation {
  /** Unique mutation id (UUID). */
  id: string
  userId: string
  entity: SyncEntity
  op: MutationOp
  recordId: string
  /** Domain-shaped record for upserts; null for deletes. */
  payload: unknown
  createdAt: string
  attempts: number
  status: 'pending' | 'failed'
  lastError: string | null
  /** ISO timestamp before which the mutation should not be retried. */
  nextAttemptAt: string | null
}

export type AppMode = 'guest' | 'cloud'

/**
 * - unconfigured: no Supabase env vars → Offline/Local mode
 * - checking:     verifying reachability
 * - connected:    a real request to Supabase succeeded
 * - offline:      configured but unreachable (network down or service error)
 */
export type ConnectionState = 'unconfigured' | 'checking' | 'connected' | 'offline'
