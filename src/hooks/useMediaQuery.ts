import { useCallback, useSyncExternalStore } from 'react'

function getMediaQueryList(query: string): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null
  return window.matchMedia(query)
}

/** Live result of a CSS media query (false when matchMedia is unavailable). */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = getMediaQueryList(query)
      if (!list) return () => undefined
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    [query],
  )
  const getSnapshot = () => getMediaQueryList(query)?.matches ?? false
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
