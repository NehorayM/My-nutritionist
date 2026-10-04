import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { DEFAULT_ROUTE, hashFor, parseHash, routeFromHash, type TabRoute } from './routes'

/** Notifies subscribers after history.replaceState, which fires no event of its own. */
const replaceListeners = new Set<() => void>()

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange)
  window.addEventListener('popstate', onChange)
  replaceListeners.add(onChange)
  return () => {
    window.removeEventListener('hashchange', onChange)
    window.removeEventListener('popstate', onChange)
    replaceListeners.delete(onChange)
  }
}

function getSnapshot(): TabRoute {
  return routeFromHash(window.location.hash)
}

/** Rewrites only the fragment; path and query string (e.g. Supabase `?code=` callbacks) are kept. */
function replaceHash(hash: string): void {
  const { pathname, search } = window.location
  window.history.replaceState(window.history.state, '', `${pathname}${search}${hash}`)
  for (const listener of replaceListeners) listener()
}

export interface HashRoute {
  route: TabRoute
  /** Pushes a history entry (Back returns to the previous tab) unless `replace` is set. */
  navigate: (route: TabRoute, options?: { replace?: boolean }) => void
}

/**
 * Tab routing on the URL fragment: "#/meals" (default), "#/progress", "#/activity", "#/profile".
 * Unknown "#/…" paths are normalized to "#/meals" in place. Fragments that are not routes (auth
 * callbacks such as "#access_token=…") are left untouched for the auth client and show Meals.
 */
export function useHashRoute(): HashRoute {
  const route = useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT_ROUTE)

  useEffect(() => {
    function normalize() {
      const parsed = parseHash(window.location.hash)
      if (parsed.kind === 'route' && parsed.route === null) replaceHash(hashFor(DEFAULT_ROUTE))
    }
    normalize()
    window.addEventListener('hashchange', normalize)
    return () => window.removeEventListener('hashchange', normalize)
  }, [])

  const navigate = useCallback((next: TabRoute, options?: { replace?: boolean }) => {
    const hash = hashFor(next)
    if (options?.replace) replaceHash(hash)
    else if (window.location.hash !== hash) window.location.hash = hash
  }, [])

  return { route, navigate }
}
