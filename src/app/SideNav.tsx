import { Leaf } from 'lucide-react'
import { cn } from '@/components/ui/cn'
import { TABS, hashFor, type TabRoute } from './routes'
import { SyncBadge } from './SyncBadge'

interface SideNavProps {
  current: TabRoute
  onPreload?: (route: TabRoute) => void
}

/**
 * Tablet/desktop navigation. md: a compact rail (icon + short label). lg: a sidebar with the app name, a line
 * about each tab and the sync status at the bottom.
 */
export function SideNav({ current, onPreload }: SideNavProps) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[var(--rail-width)] flex-col border-r border-border/70 bg-surface md:flex lg:w-[var(--sidebar-width)]">
      <a href={hashFor('meals')} className="mx-3 mt-5 mb-6 flex items-center gap-3 rounded-2xl p-2 lg:mx-4" aria-label="My-nutritionist, home">
        <span className="grid size-10 shrink-0 place-items-center rounded-[0.9rem] bg-primary text-primary-foreground shadow-card">
          <Leaf aria-hidden="true" className="size-5" />
        </span>
        <span className="hidden min-w-0 lg:block">
          <span className="block text-base font-extrabold leading-tight tracking-tight text-text">My-nutritionist</span>
          <span className="block text-xs text-text-muted">Eat well, your way</span>
        </span>
      </a>
      <nav aria-label="Primary" className="flex-1 overflow-y-auto px-2 lg:px-3">
        <ul className="grid gap-1">
          {TABS.map(({ route, label, hint, icon: Icon }) => {
            const active = route === current
            return (
              <li key={route}>
                <a
                  href={hashFor(route)}
                  aria-current={active ? 'page' : undefined}
                  onPointerEnter={() => onPreload?.(route)}
                  onFocus={() => onPreload?.(route)}
                  className={cn(
                    'group flex flex-col items-center gap-1 rounded-2xl px-1 py-2.5 text-center transition-colors duration-150 lg:flex-row lg:gap-3 lg:px-3 lg:text-left',
                    active ? 'bg-primary/12 text-primary' : 'text-text-muted hover:bg-text/5 hover:text-text',
                  )}
                >
                  <Icon aria-hidden="true" className="size-[1.35rem] shrink-0" strokeWidth={active ? 2.3 : 1.9} />
                  <span className="min-w-0">
                    <span className={cn('block text-2xs leading-tight lg:text-sm', active ? 'font-bold' : 'font-semibold')}>{label}</span>
                    <span aria-hidden="true" className="hidden truncate text-xs font-normal text-text-muted lg:block">
                      {hint}
                    </span>
                  </span>
                </a>
              </li>
            )
          })}
        </ul>
      </nav>
      <div className="border-t border-border/70 p-2 lg:p-3">
        <SyncBadge />
      </div>
    </aside>
  )
}
