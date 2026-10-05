import { SYSTEM_FOOD_ROWS } from '@/data/catalog'
import type { EntityStoreName } from '@/lib/idb'
import { logger } from '@/lib/logger'
import { clearUserData, countUserRecords, listAllForUser } from '@/repositories/local'
import { RepositoryError, type Repositories } from '@/repositories/types'
import { emptyCounts, MIGRATION_KINDS, planGuestMigration, type GuestData, type MigrationCounts, type MigrationKind, type MigrationPlan } from './plan'

export interface GuestDataSummary {
  counts: MigrationCounts
  total: number
}

export interface MigrateGuestDataInput {
  guestId: string
  userId: string
  /** The account's repositories (cloud mode: synced repositories, so imports queue for sync). */
  target: Repositories
  /** Stamped as `updatedAt` on every imported record. */
  nowIso: string
  /** Default: ids of the bundled system food catalog. */
  isSystemFood?: (foodId: string) => boolean
  /**
   * Whether the account already has a profile (then the guest profile is skipped, never imported over
   * it). Default: `target.profile.get() !== null`. Synced repositories answer from this device when the
   * server can't be reached, so cloud callers should pass a check that asks the server and throws when
   * it can't (e.g. the Supabase profile repository): the import then stops and can be retried.
   */
  accountHasProfile?: () => Promise<boolean>
}

export interface MigrationError {
  /** Neutral, user-facing message. */
  message: string
  /** True when trying again later can succeed (e.g. the server or storage was busy). */
  retryable: boolean
}

/**
 * `migrated`: records saved to the account per kind. `skipped`: records not imported — the guest
 * profile when the account already has one, unreadable records, duplicates after re-keying and
 * favorites of foods that no longer exist.
 */
export type MigrationResult =
  | { ok: true; migrated: MigrationCounts; skipped: MigrationCounts }
  | { ok: false; migrated: MigrationCounts; skipped: MigrationCounts; error: MigrationError }

const STORE_OF: Record<MigrationKind, EntityStoreName> = {
  profile: 'profiles',
  foods: 'foods',
  meals: 'meals',
  favorites: 'favorites',
  savedMeals: 'savedMeals',
  weights: 'weights',
  workouts: 'workouts',
  scheduledWorkouts: 'scheduledWorkouts',
}

const SYSTEM_FOOD_IDS: ReadonlySet<string> = new Set(SYSTEM_FOOD_ROWS.map((row) => row.id))
const isBundledSystemFood = (foodId: string): boolean => SYSTEM_FOOD_IDS.has(foodId)

const FAILURE_MESSAGE =
  'Your local data couldn’t be fully imported right now. Nothing was deleted from this device — please try again.'

/** How many records this device holds for the guest (what "Import N local items" offers). */
export async function countGuestData(guestId: string): Promise<GuestDataSummary> {
  const stored = await countUserRecords(guestId)
  const counts = emptyCounts()
  for (const kind of MIGRATION_KINDS) counts[kind] = stored[STORE_OF[kind]]
  return { counts, total: MIGRATION_KINDS.reduce((sum, kind) => sum + counts[kind], 0) }
}

async function loadGuestData(guestId: string): Promise<GuestData> {
  const [profiles, foods, meals, favorites, savedMeals, weights, workouts, scheduledWorkouts] = await Promise.all([
    listAllForUser('profiles', guestId),
    listAllForUser('foods', guestId),
    listAllForUser('meals', guestId),
    listAllForUser('favorites', guestId),
    listAllForUser('savedMeals', guestId),
    listAllForUser('weights', guestId),
    listAllForUser('workouts', guestId),
    listAllForUser('scheduledWorkouts', guestId),
  ])
  return { profile: profiles[0] ?? null, foods, meals, favorites, savedMeals, weights, workouts, scheduledWorkouts }
}

const loadedCount = (data: GuestData, kind: MigrationKind): number =>
  kind === 'profile' ? (data.profile ? 1 : 0) : data[kind].length

interface ImportContext {
  target: Repositories
  accountHasProfile: () => Promise<boolean>
  migrated: MigrationCounts
  skipped: MigrationCounts
}

/** Saves the plan in dependency order (foods before favorites, meals and saved meals). */
async function importPlan(plan: MigrationPlan, { target, accountHasProfile, migrated, skipped }: ImportContext): Promise<void> {
  if (plan.profile) {
    if (await accountHasProfile()) skipped.profile += 1
    else {
      await target.profile.save(plan.profile)
      migrated.profile += 1
    }
  }
  const saveAll = async <T>(kind: MigrationKind, records: readonly T[], save: (record: T) => Promise<T>) => {
    for (const record of records) {
      await save(record)
      migrated[kind] += 1
    }
  }
  await saveAll('foods', plan.foods, (food) => target.foods.save(food))
  await saveAll('meals', plan.meals, (meal) => target.meals.save(meal))
  await saveAll('favorites', plan.favorites, (favorite) => target.favorites.save(favorite))
  await saveAll('savedMeals', plan.savedMeals, (meal) => target.savedMeals.save(meal))
  await saveAll('weights', plan.weights, (entry) => target.weights.save(entry))
  await saveAll('workouts', plan.workouts, (entry) => target.workouts.save(entry))
  await saveAll('scheduledWorkouts', plan.scheduledWorkouts, (entry) => target.scheduledWorkouts.save(entry))
}

/**
 * Imports everything the guest stored on this device into the signed-in account (see
 * `planGuestMigration` for re-keying). The account profile is never replaced: the guest profile is
 * imported only when the account has none.
 *
 * Guest data is cleared ONLY after every record was saved. On any failure nothing is deleted and the
 * error is returned: records saved before the failure already belong to the account (this device keeps
 * one copy per record id, so records that keep their id move rather than copy), all others stay with
 * the guest, and running the import again completes it — saves are idempotent upserts and references
 * to foods that already moved are preserved.
 */
export async function migrateGuestData(input: MigrateGuestDataInput): Promise<MigrationResult> {
  const { guestId, userId, target } = input
  const migrated = emptyCounts()
  const skipped = emptyCounts()
  try {
    if (guestId === userId || target.userId !== userId) {
      throw new RepositoryError('Guest import needs a different guest and account, and repositories of that account', {
        retryable: false,
      })
    }
    const [stored, data, accountFoods] = await Promise.all([countGuestData(guestId), loadGuestData(guestId), target.foods.list()])
    const plan = await planGuestMigration(data, {
      userId,
      nowIso: input.nowIso,
      isSystemFood: input.isSystemFood ?? isBundledSystemFood,
      accountFoodIds: new Set(accountFoods.map((food) => food.id)),
    })
    for (const kind of MIGRATION_KINDS) {
      skipped[kind] = Math.max(0, stored.counts[kind] - loadedCount(data, kind)) + plan.dropped[kind]
    }
    const accountHasProfile = input.accountHasProfile ?? (async () => (await target.profile.get()) !== null)
    await importPlan(plan, { target, accountHasProfile, migrated, skipped })
    await clearUserData(guestId)
    return { ok: true, migrated, skipped }
  } catch (error) {
    logger.warn('migration', 'Guest data import stopped; nothing was deleted', error)
    const retryable = error instanceof RepositoryError ? error.retryable : false
    return { ok: false, migrated, skipped, error: { message: FAILURE_MESSAGE, retryable } }
  }
}
