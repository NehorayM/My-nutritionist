import type { ReactNode } from 'react'
import { cn } from '@/components/ui/cn'

/** Padding of a screen's content (matches ScreenHeader). */
export const SCREEN_PADDING = 'px-4 sm:px-5 md:px-8 lg:px-10'

export function ScreenBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn(SCREEN_PADDING, 'pb-8 pt-2', className)}>{children}</div>
}

interface ScreenColumnsProps {
  /** Shown first on phones; top of the right column on desktop (e.g. today's summary). */
  lead?: ReactNode
  /** The screen's main task (left column on desktop). */
  main: ReactNode
  /** Supporting content: after the main content on phones, below `lead` on the right on desktop. */
  aside?: ReactNode
  className?: string
}

/** A column whose children may shrink below their content width (carousels and long text never widen the page). */
const COLUMN = 'grid min-w-0 gap-5 [&>*]:min-w-0'

/**
 * Responsive screen layout. Phones and tablets: one column in the order lead → main → aside. From lg: two
 * columns (≈ 7 : 5) with the main content on the left and lead + aside stacked on the right.
 */
export function ScreenColumns({ lead, main, aside, className }: ScreenColumnsProps) {
  return (
    <div className={cn('grid gap-5 lg:grid-cols-12 lg:items-start lg:gap-x-8 lg:gap-y-5', className)}>
      {lead ? <div className={cn(COLUMN, 'lg:col-span-5 lg:col-start-8 lg:row-start-1')}>{lead}</div> : null}
      <div className={cn(COLUMN, 'lg:col-span-7 lg:col-start-1 lg:row-span-2 lg:row-start-1')}>{main}</div>
      {aside ? <div className={cn(COLUMN, 'lg:col-span-5 lg:col-start-8', lead ? 'lg:row-start-2' : 'lg:row-start-1')}>{aside}</div> : null}
    </div>
  )
}
