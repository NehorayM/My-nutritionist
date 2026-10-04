/**
 * Runtime validation for every persisted record (Zod 4). Used by repositories (validate on read and
 * write), the sync outbox (validate payloads before flushing) and UI forms (shared `LIMITS`).
 */
export { BARCODE_PATTERN, COUNT_LIMITS, LIMITS, TEXT_LIMITS } from './limits'
export {
  boundedText,
  dateKeySchema,
  dateRangeSchema,
  intInRange,
  isoTimestampSchema,
  numberInRange,
  positiveUpTo,
  textLength,
  uuidSchema,
} from './primitives'
export { nutrientProfileSchema, nutrientsPer100gSchema, nutrientValueSchema } from './nutrition'
export { dietFlagsSchema, foodItemSchema, servingOptionSchema } from './food'
export { favoriteSchema, foodPortionSchema, mealEntrySchema, savedMealSchema } from './meal'
export { birthDateSchema, profileSchema, reminderPreferencesSchema } from './profile'
export { scheduledWorkoutSchema, weightEntrySchema, workoutEntrySchema } from './activity'
export { MUTATION_OPS, OUTBOX_STATUSES, outboxMutationSchema } from './sync'
export { ENTITY_SCHEMAS, ownerOf, recordIdOf, type EntityRecord, type EntityRecordMap } from './entities'
export {
  checkDateRange,
  invalidFieldPaths,
  normalizeLimit,
  parseOwnedRecord,
  parseOwnedRecords,
  readOwner,
  RECORD_SPECS,
  validateForWrite,
  type RecordSpec,
} from './records'
