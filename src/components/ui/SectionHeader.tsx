import type { ReactNode } from 'react'
import { cn } from './cn'

interface SectionHeaderProps {
  title: ReactNode
  description?: ReactNode
  /** Trailing action, e.g. a ghost Button "See all". */
  action?: ReactNode
  as?: 'h2' | 'h3'
  id?: string
  className?: string
}

/** Heading for a group of cards within a screen. Pass `id` and use it as the section's aria-labelledby. */
export function SectionHeader({ title, description, action, as: Heading = 'h2', id, className }: SectionHeaderProps) {
  return (
    <div className={cn('flex items-end justify-between gap-3', className)}>
      <div className="min-w-0 space-y-0.5">
        <Heading id={id} className="text-lg font-bold leading-tight tracking-tight text-text">
          {title}
        </Heading>
        {description ? <p className="text-sm text-text-muted">{description}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-1">{action}</div> : null}
    </div>
  )
}
