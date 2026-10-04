import type { InputHTMLAttributes, ReactNode, Ref } from 'react'
import { cn } from './cn'
import { CONTROL_BASE, CONTROL_HEIGHT } from './controlStyles'
import { useFieldControlProps } from './fieldContext'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Decorative icon inside the start of the field (e.g. a search glass). */
  leading?: ReactNode
  /** Short trailing text or element such as a unit ("kg") or a clear button. */
  trailing?: ReactNode
  ref?: Ref<HTMLInputElement>
}

export function Input({ leading, trailing, className, ref, ...props }: InputProps) {
  const wired = useFieldControlProps(props)
  const input = (
    <input
      ref={ref}
      className={cn(
        CONTROL_BASE,
        CONTROL_HEIGHT,
        leading != null && 'pl-10',
        trailing != null && 'pr-12',
        !leading && !trailing && className,
      )}
      {...wired}
    />
  )
  if (leading == null && trailing == null) return input
  return (
    <div className={cn('relative flex items-center', className)}>
      {leading != null ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-3.5 flex text-text-muted [&_svg]:size-[1.125rem]"
        >
          {leading}
        </span>
      ) : null}
      {input}
      {trailing != null ? (
        <span className="absolute right-1.5 flex min-w-9 items-center justify-center text-sm font-semibold text-text-muted">
          {trailing}
        </span>
      ) : null}
    </div>
  )
}
