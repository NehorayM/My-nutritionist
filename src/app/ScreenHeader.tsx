import type { ReactNode } from 'react'
import { cn } from '@/components/ui/cn'

interface ScreenHeaderProps {
  title: ReactNode
  /** Small line above the title (e.g. the date). */
  eyebrow?: ReactNode
  subtitle?: ReactNode
  /** Trailing controls (IconButtons, a compact Button). */
  actions?: ReactNode
  /** Content under the title row that should stick with it (e.g. a date switcher or tabs). */
  children?: ReactNode
  titleId?: string
  className?: string
}

/**
 * Sticky top-of-screen header with the screen's single <h1>. Solid background (no blur); a hairline
 * edge fades in once the screen scrolls (`scroll-edge`).
 */
export function ScreenHeader({ title, eyebrow, subtitle, actions, children, titleId, className }: ScreenHeaderProps) {
  return (
    <header className={cn('scroll-edge sticky top-0 z-10 bg-bg pt-safe', className)}>
      <div className="flex items-end gap-3 px-5 pb-3 pt-5">
        <div className="min-w-0 flex-1">
          {eyebrow ? <p className="mb-0.5 text-xs font-bold uppercase tracking-[0.08em] text-accent-ink">{eyebrow}</p> : null}
          <h1 id={titleId} className="text-title font-extrabold text-text">
            {title}
          </h1>
          {subtitle ? <p className="mt-0.5 text-sm text-text-muted">{subtitle}</p> : null}
        </div>
        {actions ? <div className="-mr-1.5 flex shrink-0 items-center gap-1 pb-0.5">{actions}</div> : null}
      </div>
      {children ? <div className="px-5 pb-3">{children}</div> : null}
    </header>
  )
}
