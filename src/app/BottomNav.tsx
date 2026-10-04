import { cn } from '@/components/ui/cn'
import { TABS, hashFor, type TabRoute } from './routes'

interface BottomNavProps {
  current: TabRoute
  /** Called on hover/focus/touch of a tab so its code can start loading early. */
  onPreload?: (route: TabRoute) => void
}

/**
 * Persistent primary navigation: four hash links. The only translucent (blurred) surface in the
 * app, with a solid fallback (see `bar-surface` in index.css).
 */
export function BottomNav({ current, onPreload }: BottomNavProps) {
  return (
    <nav aria-label="Primary" className="bar-surface absolute inset-x-0 bottom-0 z-20 border-t border-border/70 pb-safe">
      <ul className="grid grid-cols-4 gap-1 px-2 py-1.5">
        {TABS.map(({ route, label, icon: Icon }) => {
          const active = route === current
          return (
            <li key={route} className="min-w-0">
              <a
                href={hashFor(route)}
                aria-current={active ? 'page' : undefined}
                onPointerEnter={() => onPreload?.(route)}
                onFocus={() => onPreload?.(route)}
                onTouchStart={() => onPreload?.(route)}
                className={cn(
                  'group flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-1 text-center',
                  'focus-visible:outline-offset-0',
                  active ? 'text-primary' : 'text-text-muted hover:text-text',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'grid h-8 w-14 max-w-full place-items-center rounded-full',
                    'transition-[background-color,transform] duration-200 ease-out-soft motion-reduce:transition-none',
                    active ? 'bg-primary/14' : 'group-hover:bg-text/6 group-active:scale-95',
                  )}
                >
                  <Icon className="size-[1.375rem]" strokeWidth={active ? 2.3 : 1.9} />
                </span>
                <span
                  className={cn(
                    'line-clamp-2 max-w-full text-2xs leading-tight [overflow-wrap:anywhere]',
                    active ? 'font-bold' : 'font-semibold',
                  )}
                >
                  {label}
                </span>
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
