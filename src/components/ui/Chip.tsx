import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react'
import { cn } from './cn'

export const CHIP_BASE =
  'hit-area inline-flex h-9 shrink-0 select-none items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 ' +
  'text-sm font-semibold transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50 ' +
  'motion-reduce:transition-none [&_svg]:size-4 [&_svg]:shrink-0'

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: ReactNode
  ref?: Ref<HTMLButtonElement>
}

/** Compact pill action (quick add, suggestion). For on/off filters use ToggleChip. */
export function Chip({ icon, type = 'button', className, children, ref, ...rest }: ChipProps) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(CHIP_BASE, 'border-border bg-surface text-text hover:bg-surface-2', className)}
      {...rest}
    >
      {icon}
      {children}
    </button>
  )
}
