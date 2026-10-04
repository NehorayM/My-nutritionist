import { cn } from './cn'

interface SkeletonProps {
  className?: string
  /** Pill/circle shapes for avatars and chips. */
  shape?: 'block' | 'pill' | 'circle'
}

/** Decorative placeholder while content loads. Pair with a LoadingState or aria-busy container. */
export function Skeleton({ className, shape = 'block' }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'animate-pulse bg-text/8 motion-reduce:animate-none',
        shape === 'block' && 'rounded-xl',
        shape === 'pill' && 'rounded-full',
        shape === 'circle' && 'rounded-full',
        className,
      )}
    />
  )
}
