/**
 * Stores that hold per-user data register a reset function here. When the session switches user
 * or mode (guest ↔ account, sign-out), bootstrap calls `resetUserStores()` so no data from the
 * previous user can leak into the next one.
 *
 * Every reset also starts a new session epoch. Async store work (loads, saves) captures the epoch when
 * it starts and drops its result when the epoch moved on — a slow request of the previous user can
 * then never write into the next user's state.
 */
type Reset = () => void

const resets = new Set<Reset>()
let epoch = 0

export function registerUserStoreReset(reset: Reset): void {
  resets.add(reset)
}

export function resetUserStores(): void {
  epoch += 1
  for (const reset of resets) reset()
}

/** The current session epoch (see above). */
export function currentEpoch(): number {
  return epoch
}

/** A check bound to the epoch at call time: true while the same session is active. */
export function sessionGuard(): () => boolean {
  const started = epoch
  return () => started === epoch
}
