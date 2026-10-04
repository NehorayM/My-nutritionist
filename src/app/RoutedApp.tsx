import { Suspense, useEffect, useRef } from 'react'
import { AppShell } from './AppShell'
import { BottomNav } from './BottomNav'
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
 * The navigable app: shell + bottom navigation + the current tab's screen (each isolated by an
 * error boundary and a Suspense fallback). Wrap it with session/bootstrap gates as needed.
 */
export function RoutedApp() {
  const { route } = useHashRoute()
  const mainRef = useRef<HTMLElement>(null)
  const previousRoute = useRef(route)
  const label = TABS.find((tab) => tab.route === route)?.label ?? APP_NAME
  const { Component } = SCREENS[route]

  useEffect(() => {
    document.title = `${label} · ${APP_NAME}`
  }, [label])

  useEffect(() => {
    if (previousRoute.current === route) return
    previousRoute.current = route
    const main = mainRef.current
    if (!main) return
    main.scrollTop = 0
    // Focus stays on the tab that was activated; if it was inside the old screen, move it to <main>.
    const active = document.activeElement
    if (!active || active === document.body || !active.isConnected) main.focus({ preventScroll: true })
  }, [route])

  return (
    <AppShell mainRef={mainRef} nav={<BottomNav current={route} onPreload={preload} />}>
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
