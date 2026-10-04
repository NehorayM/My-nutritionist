import { RepositoryError } from '@/repositories/types'
import { describeError, logger } from '@/lib/logger'

/** Short, neutral user-facing message for a failed data operation; diagnostics go to the logger. */
export function userMessageFor(error: unknown, action: string): string {
  logger.warn('store', `${action} failed`, error)
  if (error instanceof RepositoryError && error.retryable) {
    return `Couldn't ${action} right now. Check your connection and try again.`
  }
  return `Couldn't ${action}. Please try again.`
}

export { describeError }
