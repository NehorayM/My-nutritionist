import { useSyncExternalStore } from 'react'
import { unsubscribeTokenFromHash } from './routes'

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

/** The token of an email unsubscribe link in the URL ("#/unsubscribe?token=…"), live; null otherwise. */
export function useUnsubscribeToken(): string | null {
  return useSyncExternalStore(subscribe, () => unsubscribeTokenFromHash(window.location.hash), () => null)
}
