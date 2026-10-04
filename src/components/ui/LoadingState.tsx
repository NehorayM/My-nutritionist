import { cn } from './cn'
import { Spinner } from './Spinner'

interface LoadingStateProps {
  /** Announced and shown, e.g. "Loading your meals…". */
  label?: string
  className?: string
}

/** Centered spinner + text, announced politely to screen readers (<output> = role status). */
export function LoadingState({ label = 'Loading…', className }: LoadingStateProps) {
  return (
    <output
      aria-live="polite"
      className={cn('flex flex-col items-center justify-center gap-3 px-6 py-12 text-text-muted', className)}
    >
      <Spinner className="size-6 text-primary" />
      <p className="text-sm font-medium">{label}</p>
    </output>
  )
}
