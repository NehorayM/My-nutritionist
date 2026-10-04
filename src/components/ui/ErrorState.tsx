import { CloudOff, RotateCcw } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from './cn'
import { Button } from './Button'

interface ErrorStateProps {
  title?: ReactNode
  description?: ReactNode
  /** Shows a "Try again" button. */
  onRetry?: () => void
  retryLabel?: string
  retrying?: boolean
  icon?: ReactNode
  /** Extra actions next to retry. */
  actions?: ReactNode
  className?: string
}

/** Recoverable error message with an optional retry. Announced to assistive tech when it appears. */
export function ErrorState({
  title = 'Something went wrong',
  description = 'Your data is safe. Please try again.',
  onRetry,
  retryLabel = 'Try again',
  retrying = false,
  icon = <CloudOff />,
  actions,
  className,
}: ErrorStateProps) {
  return (
    <div role="alert" className={cn('flex flex-col items-center gap-3 px-6 py-10 text-center', className)}>
      <div aria-hidden="true" className="grid size-14 place-items-center rounded-full bg-warning/14 text-warning [&_svg]:size-6">
        {icon}
      </div>
      <div className="max-w-xs space-y-1">
        <p className="text-base font-bold tracking-tight text-text">{title}</p>
        {description ? <p className="text-sm text-text-muted">{description}</p> : null}
      </div>
      {onRetry || actions ? (
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
          {onRetry ? (
            <Button variant="secondary" leadingIcon={<RotateCcw />} loading={retrying} onClick={onRetry}>
              {retryLabel}
            </Button>
          ) : null}
          {actions}
        </div>
      ) : null}
    </div>
  )
}
