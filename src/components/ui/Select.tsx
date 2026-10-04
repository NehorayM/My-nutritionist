import { ChevronDown } from 'lucide-react'
import type { Ref, SelectHTMLAttributes } from 'react'
import { cn } from './cn'
import { CONTROL_BASE, CONTROL_HEIGHT } from './controlStyles'
import { useFieldControlProps } from './fieldContext'

export interface SelectOption<V extends string = string> {
  value: V
  label: string
  disabled?: boolean
}

export interface SelectProps<V extends string = string>
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'value' | 'onChange' | 'children'> {
  value: V
  onValueChange: (value: V) => void
  options: readonly SelectOption<V>[]
  ref?: Ref<HTMLSelectElement>
}

/** Native <select> (best mobile pickers and accessibility) with the kit's styling. */
export function Select<V extends string = string>({
  value,
  onValueChange,
  options,
  className,
  ref,
  ...props
}: SelectProps<V>) {
  const wired = useFieldControlProps(props)
  return (
    <div className={cn('relative flex items-center', className)}>
      <select
        ref={ref}
        value={value}
        onChange={(event) => {
          const next = options.find((option) => option.value === event.target.value)
          if (next) onValueChange(next.value)
        }}
        className={cn(CONTROL_BASE, CONTROL_HEIGHT, 'appearance-none pr-10')}
        {...wired}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3.5 size-4 text-text-muted" />
    </div>
  )
}
