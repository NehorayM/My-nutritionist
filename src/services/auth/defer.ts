import { logger } from '@/lib/logger'
import { browserTimers, type Timers } from '@/services/sync/timers'

/**
 * Runs auth follow-up work (loading data, swapping repositories, other Supabase calls) after the
 * auth callback has returned. Never await Supabase calls inside an `onAuthStateChange` listener.
 */
export function deferAuthWork(task: () => Promise<void> | void, timers: Timers = browserTimers): void {
  timers.setTimeout(() => {
    Promise.resolve()
      .then(task)
      .catch((error: unknown) => logger.error('auth', 'Deferred auth work failed', error))
  }, 0)
}
