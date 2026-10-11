import { Suspense, useEffect, useRef } from 'react'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { AppShell } from './AppShell'
import { BottomNav } from './BottomNav'
import { SideNav } from './SideNav'
import { TABS, type TabRoute } from './routes'
import { ScreenErrorBoundary } from './ScreenErrorBoundary'
import { ScreenFallback } from './ScreenFallback'
import { SCREENS } from './screens'
import { useHashRoute } from './useHashRoute'

const APP_NAME = 'My-nutritionist'

function preload(route: TabRoute): void {
  SCREENS[route].preload()
}

/**
 * The navigable app: shell + navigation (bottom bar on phones, side navigation from md) + the current tab's
 * screen (each isolated by an error boundary and a Suspense fallback). Wrap it with session gates as needed.
 */
export function RoutedApp() {
  const { route } = useHashRoute()
  const mainRef = useRef<HTMLElement>(null)
  const previousRoute = useRef(route)
  const label = TABS.find((tab) => tab.route === route)?.label ?? APP_NAME
  const { Component } = SCREENS[route]
  // One primary navigation at a time: the side navigation from md (48 rem), the bottom bar below.
  const wide = useMediaQuery('(min-width: 48rem)')

  useEffect(() => {
    document.title = `${label} · ${APP_NAME}`
  }, [label])

  useEffect(() => {
    if (previousRoute.current === route) return
    previousRoute.current = route
    const main = mainRef.current
    if (!main) return
    window.scrollTo({ top: 0 })
    // Focus stays on the tab that was activated; if it was inside the old screen, move it to <main>.
    const active = document.activeElement
    if (!active || active === document.body || !active.isConnected) main.focus({ preventScroll: true })
  }, [route])

  return (
    <AppShell
      mainRef={mainRef}
      sidebar={wide ? <SideNav current={route} onPreload={preload} /> : undefined}
      bottomNav={wide ? undefined : <BottomNav current={route} onPreload={preload} />}
    >
      <div key={route} data-route={route} className="animate-screen-in motion-reduce:animate-none">
        <ScreenErrorBoundary screenName={label}>
          <Suspense fallback={<ScreenFallback label={label} />}>
            <Component />
          </Suspense>
        </ScreenErrorBoundary>
      </div>
    </AppShell>
  )
}
