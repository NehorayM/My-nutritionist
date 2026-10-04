import type { ReactNode } from 'react'
import { cn } from './cn'

interface EmptyStateProps {
  /** A lucide icon element; decorative. */
  icon?: ReactNode
  title: ReactNode
  description?: ReactNode
  /** One or two actions (Buttons/Chips) that resolve the empty state. */
  actions?: ReactNode
  /** Heading level for the title. Default h3. */
  headingLevel?: 'h2' | 'h3' | 'h4'
  compact?: boolean
  className?: string
}

/** Friendly "nothing here yet" block that points to the next step. */
export function EmptyState({
  icon,
  title,
  description,
  actions,
  headingLevel: Heading = 'h3',
  compact = false,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center text-center',
        compact ? 'gap-2 px-4 py-6' : 'gap-3 px-6 py-10',
        className,
      )}
    >
      {icon ? (
        <div
          aria-hidden="true"
          className={cn(
            'grid place-items-center rounded-full bg-primary/10 text-primary',
            compact ? 'size-11 [&_svg]:size-5' : 'size-14 [&_svg]:size-6',
          )}
        >
          {icon}
        </div>
      ) : null}
      <div className="max-w-xs space-y-1">
        <Heading className="text-base font-bold tracking-tight text-text">{title}</Heading>
        {description ? <p className="text-sm text-text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="mt-1 flex flex-wrap items-center justify-center gap-2">{actions}</div> : null}
    </div>
  )
}
