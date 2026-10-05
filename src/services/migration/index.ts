/**
 * Guest → account import: `countGuestData(guestId)` for the "Import N local items" offer, then
 * `migrateGuestData({ guestId, userId, target, nowIso })` with the account's repositories.
 */
export {
  countGuestData,
  migrateGuestData,
  type GuestDataSummary,
  type MigrateGuestDataInput,
  type MigrationError,
  type MigrationResult,
} from './guestMigration'
export { emptyCounts, MIGRATION_KINDS, planGuestMigration, type MigrationCounts, type MigrationKind } from './plan'
