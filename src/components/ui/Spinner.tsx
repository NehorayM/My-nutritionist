import { cn } from './cn'

interface SpinnerProps {
  className?: string
  /** When given, the spinner is announced as a status; otherwise it is decorative. */
  label?: string
}

/** Indeterminate activity indicator. Keeps a slow rotation under reduced motion (it conveys state). */
export function Spinner({ className, label }: SpinnerProps) {
  const svg = (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      data-motion="essential"
      className={cn('size-5 animate-spin', className)}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
  if (!label) return svg
  return (
    <output className="inline-flex">
      {svg}
      <span className="sr-only">{label}</span>
    </output>
  )
}
