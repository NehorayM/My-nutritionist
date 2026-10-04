/**
 * Stores that hold per-user data register a reset function here. When the session switches user
 * or mode (guest ↔ account, sign-out), bootstrap calls `resetUserStores()` so no data from the
 * previous user can leak into the next one.
 */
type Reset = () => void

const resets = new Set<Reset>()

export function registerUserStoreReset(reset: Reset): void {
  resets.add(reset)
}

export function resetUserStores(): void {
  for (const reset of resets) reset()
}
