import { useId, type ReactNode } from 'react'
import { cn } from './cn'

export interface SegmentedOption<V extends string> {
  value: V
  label: ReactNode
  /** Accessible name when the label is only an icon. */
  ariaLabel?: string
  disabled?: boolean
}

interface SegmentedControlProps<V extends string> {
  value: V
  onValueChange: (value: V) => void
  options: readonly SegmentedOption<V>[]
  /** Accessible name of the group (e.g. "Chart range"). */
  label: string
  size?: 'sm' | 'md'
  fullWidth?: boolean
  /** Form field name; generated when omitted. */
  name?: string
  className?: string
}

/**
 * Single choice among 2–5 short options, built on native radio inputs: one tab stop for the
 * group (roving focus) and arrow keys move + select, exactly like the platform radio group.
 */
export function SegmentedControl<V extends string>({
  value,
  onValueChange,
  options,
  label,
  size = 'md',
  fullWidth = false,
  name,
  className,
}: SegmentedControlProps<V>) {
  const generatedName = `segmented-${useId()}`
  const groupName = name ?? generatedName

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        'inline-flex gap-1 rounded-full bg-surface-2 p-1 ring-1 ring-border/60',
        fullWidth && 'flex w-full',
        className,
      )}
    >
      {options.map((option) => {
        const checked = option.value === value
        return (
          <label
            key={option.value}
            className={cn(
              'relative inline-flex min-w-0 cursor-pointer items-center justify-center gap-1.5 rounded-full px-3.5 font-semibold',
              'transition-[background-color,color,box-shadow] duration-200 ease-out-soft motion-reduce:transition-none',
              'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring',
              'has-disabled:cursor-not-allowed has-disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
              size === 'sm' ? 'hit-area h-8 text-sm' : 'h-10 text-[0.9375rem]',
              fullWidth && 'flex-1',
              checked ? 'bg-surface text-text shadow-thumb' : 'text-text-muted hover:text-text',
            )}
          >
            <input
              type="radio"
              name={groupName}
              value={option.value}
              checked={checked}
              disabled={option.disabled}
              aria-label={option.ariaLabel}
              onChange={() => onValueChange(option.value)}
              className="sr-only"
            />
            <span className="truncate">{option.label}</span>
          </label>
        )
      })}
    </div>
  )
}
