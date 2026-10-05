import { logger } from '@/lib/logger'

/** A set of listeners; one throwing listener never prevents the others from being called. */
export interface ListenerSet<T> {
  add(listener: (value: T) => void): () => void
  emit(value: T): void
  clear(): void
}

export function createListenerSet<T>(scope: string): ListenerSet<T> {
  const listeners = new Set<(value: T) => void>()
  return {
    add(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    emit(value) {
      for (const listener of [...listeners]) {
        try {
          listener(value)
        } catch (error) {
          logger.error(scope, 'A listener failed', error)
        }
      }
    },
    clear() {
      listeners.clear()
    },
  }
}
