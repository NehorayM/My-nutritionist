import type { ReactNode, Ref } from 'react'

interface AppShellProps {
  /** The current screen. */
  children: ReactNode
  /** Bottom navigation, overlaid on the scroll area so content scrolls under its translucent bar (absent on the welcome screen). */
  nav?: ReactNode
  mainRef?: Ref<HTMLElement>
}

/**
 * Phone: full-bleed column filling the dynamic viewport. From `sm`: a centered ≈30 rem column in a
 * rounded, shadowed frame on a soft backdrop. The screen scrolls inside <main>.
 */
export function AppShell({ children, nav, mainRef }: AppShellProps) {
  return (
    <div className="app-backdrop min-h-dvh sm:grid sm:place-items-center sm:p-6">
      <div
        className={
          'relative isolate mx-auto flex h-dvh w-full flex-col overflow-hidden bg-bg ' +
          'sm:h-[min(var(--frame-max-height),calc(100dvh-3rem))] sm:max-w-[30rem] sm:rounded-frame ' +
          'sm:shadow-frame sm:ring-1 sm:ring-border/80'
        }
      >
        <main
          ref={mainRef}
          id="main"
          tabIndex={-1}
          className={
            'scrollbar-soft min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-safe outline-none ' +
            (nav ? 'pb-[calc(var(--nav-height)+env(safe-area-inset-bottom,0px)+1.5rem)]' : 'pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]')
          }
        >
          {children}
        </main>
        {nav}
      </div>
    </div>
  )
}
