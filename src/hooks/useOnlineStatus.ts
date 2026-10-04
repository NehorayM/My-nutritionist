import { useSyncExternalStore } from 'react'

function subscribe(onChange: () => void): () => void {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

function getSnapshot(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine
}

/**
 * Browser connectivity hint (navigator.onLine + online/offline events).
 * `true` does not prove a server is reachable; sync status comes from services/sync.
 */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => true)
}
