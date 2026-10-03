import type { Repositories } from '@/repositories/types'

/**
 * Holds the repository set for the active session (guest/local or cloud/synced).
 * Bootstrap swaps it when the mode or user changes; stores read it in their actions.
 */
type Listener = (repositories: Repositories | null) => void

let current: Repositories | null = null
const listeners = new Set<Listener>()

export function setRepositories(next: Repositories | null): void {
  current = next
  for (const listener of listeners) listener(next)
}

export function hasRepositories(): boolean {
  return current !== null
}

export function getRepositories(): Repositories {
  if (!current) throw new Error('Repositories are not initialized yet')
  return current
}

export function subscribeRepositories(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
