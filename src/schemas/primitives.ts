import { z } from 'zod'
import { isDateKey } from '@/domain/dates'
import { isUuid } from '@/lib/id'

/** Length in Unicode code points — the same unit as Postgres `char_length`. */
export function textLength(value: string): number {
  return Array.from(value).length
}

/** Text whose length (code points) is within [min, max]. */
export function boundedText(min: number, max: number) {
  const message = min > 0 ? `Must be ${min}–${max} characters` : `Must be at most ${max} characters`
  return z.string().refine(
    (value) => {
      const length = textLength(value)
      return length >= min && length <= max
    },
    { message },
  )
}

/** RFC 4122 UUID (any version 1–8), as produced by `lib/id.ts` and Postgres `gen_random_uuid()`. */
export const uuidSchema = z.string().refine(isUuid, { message: 'Must be a valid id' })

/** Local calendar date key `YYYY-MM-DD` naming a real date (no 2026-02-30). */
export const dateKeySchema = z.string().refine(isDateKey, { message: 'Must be a real date (YYYY-MM-DD)' })

/**
 * ISO-8601 timestamp WITH a UTC designator or offset (`Z`, `+00:00`, `+03:00`).
 * Parsed values are canonicalized to `Date#toISOString()` (UTC, millisecond precision) so that
 * timestamps from Postgres (`…456789+00:00`) and from the app (`…456Z`) sort correctly as strings.
 */
export const isoTimestampSchema = z.iso
  .datetime({ offset: true, message: 'Must be an ISO timestamp with a time zone' })
  .transform((value, ctx) => {
    const ms = Date.parse(value)
    if (Number.isNaN(ms)) {
      ctx.issues.push({ code: 'custom', message: 'Must be an ISO timestamp with a time zone', input: value })
      return z.NEVER
    }
    return new Date(ms).toISOString()
  })

/** Inclusive local-date range used by `listRange` queries. */
export const dateRangeSchema = z.object({
  from: dateKeySchema,
  to: dateKeySchema,
})

/** Number within an inclusive range. */
export function numberInRange(range: { readonly min: number; readonly max: number }) {
  return z.number().min(range.min).max(range.max)
}

/** Integer within an inclusive range (for Postgres smallint columns). */
export function intInRange(range: { readonly min: number; readonly max: number }) {
  return z.number().int().min(range.min).max(range.max)
}

/** Number greater than zero and at most `max`. */
export function positiveUpTo(max: number) {
  return z.number().positive().max(max)
}
