import { abortedError, createTimeoutReason, toProviderError } from './providerErrors'
import type { FoodProviderError, FoodProviderId } from './providers/types'

export interface DeadlineOptions {
  /** Caller's signal; aborting it aborts the provider call. */
  signal?: AbortSignal
  timeoutMs: number
}

/**
 * Runs one provider call with its own AbortController that is aborted when the time budget runs out
 * (reason: TimeoutError) or when the caller's signal aborts (reason: the caller's reason).
 * The call is also raced against that abort, so a provider that ignores its signal cannot hang a search.
 * Every failure is normalized to a FoodProviderError.
 */
export async function runWithDeadline<T>(
  providerId: FoodProviderId,
  task: (signal: AbortSignal) => Promise<T>,
  options: DeadlineOptions,
): Promise<T> {
  const { signal: callerSignal } = options
  // A cancelled caller never starts the provider call.
  if (callerSignal?.aborted) throw abortedError(providerId, callerSignal)
  const controller = new AbortController()
  const onCallerAbort = () => controller.abort(callerSignal?.reason)
  callerSignal?.addEventListener('abort', onCallerAbort, { once: true })
  const timer = setTimeout(() => controller.abort(createTimeoutReason()), Math.max(0, options.timeoutMs))

  let rejectOnAbort: ((error: FoodProviderError) => void) | null = null
  const aborted = new Promise<never>((_, reject) => {
    rejectOnAbort = reject
  })
  const onAbort = () => rejectOnAbort?.(abortedError(providerId, controller.signal))
  controller.signal.addEventListener('abort', onAbort, { once: true })

  try {
    // The abort comes first so it wins when both have already settled.
    return await Promise.race([aborted, task(controller.signal)])
  } catch (error) {
    throw toProviderError(providerId, error, controller.signal)
  } finally {
    clearTimeout(timer)
    callerSignal?.removeEventListener('abort', onCallerAbort)
    controller.signal.removeEventListener('abort', onAbort)
  }
}
