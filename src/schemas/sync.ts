import { z } from 'zod'
import { SYNC_ENTITIES } from '@/types'
import { isoTimestampSchema, uuidSchema } from './primitives'

export const MUTATION_OPS = ['upsert', 'delete'] as const
export const OUTBOX_STATUSES = ['pending', 'failed'] as const

/**
 * A queued local change. `payload` is the domain-shaped record for upserts (validated against the
 * entity's own schema when it is flushed) and must be `null` for deletes.
 */
export const outboxMutationSchema = z
  .object({
    id: uuidSchema,
    userId: uuidSchema,
    entity: z.enum(SYNC_ENTITIES),
    op: z.enum(MUTATION_OPS),
    recordId: uuidSchema,
    payload: z.unknown(),
    createdAt: isoTimestampSchema,
    attempts: z.number().int().min(0),
    status: z.enum(OUTBOX_STATUSES),
    lastError: z.string().nullable(),
    nextAttemptAt: isoTimestampSchema.nullable(),
  })
  .refine((mutation) => (mutation.op === 'delete' ? mutation.payload === null : mutation.payload != null), {
    message: 'Upserts carry a record payload; deletes carry none',
    path: ['payload'],
  })
