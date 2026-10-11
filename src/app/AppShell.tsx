import type { ReactNode, Ref } from 'react'
import { cn } from '@/components/ui/cn'

interface AppShellProps {
  /** The current screen. */
  children: ReactNode
  /** Side navigation (rail from md, sidebar from lg); absent on the welcome screen. */
  sidebar?: ReactNode
  /** Bottom tab bar for phones (hidden from md). */
  bottomNav?: ReactNode
  mainRef?: Ref<HTMLElement>
}

/**
 * Responsive app frame. Phones: full-width column, the page scrolls, a tab bar sits at the bottom. Tablets: a
 * navigation rail on the left. Desktop: a labelled sidebar and a wide content area (screens lay out in columns).
 */
export function AppShell({ children, sidebar, bottomNav, mainRef }: AppShellProps) {
  return (
    <div className="min-h-dvh bg-bg">
      {sidebar}
      <div className={cn(sidebar && 'md:pl-[var(--rail-width)] lg:pl-[var(--sidebar-width)]')}>
        <main
          ref={mainRef}
          id="main"
          tabIndex={-1}
          className={cn(
            'mx-auto w-full max-w-[82rem] px-safe outline-none',
            bottomNav ? 'pb-[calc(var(--nav-height)+env(safe-area-inset-bottom,0px)+1.5rem)] md:pb-12' : 'pb-12',
          )}
        >
          {children}
        </main>
      </div>
      {bottomNav}
    </div>
  )
}
