import type { ReactNode } from 'react'
import { cn } from './cn'
import { TONE_TEXT, type Tone } from './tones'

interface StatProps {
  label: ReactNode
  /** Pre-formatted value (use lib/format), e.g. "72.4". */
  value: ReactNode
  /** Unit rendered smaller next to the value, e.g. "kg". */
  unit?: ReactNode
  /** Secondary line, e.g. "since last week". */
  hint?: ReactNode
  tone?: Tone
  size?: 'sm' | 'md' | 'lg'
  align?: 'start' | 'center'
  className?: string
}

const VALUE_SIZES = { sm: 'text-lg', md: 'text-2xl', lg: 'text-display' } as const

/** A labelled number. Label comes first in reading order so screen readers say "Current weight, 72.4 kg". */
export function Stat({ label, value, unit, hint, tone, size = 'md', align = 'start', className }: StatProps) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-0.5', align === 'center' && 'items-center text-center', className)}>
      <span className="text-xs font-semibold text-text-muted">{label}</span>
      <span className={cn('font-bold leading-tight tracking-tight tabular-nums', VALUE_SIZES[size], tone ? TONE_TEXT[tone] : 'text-text')}>
        {value}
        {unit ? <span className="ml-1 text-[0.55em] font-semibold text-text-muted">{unit}</span> : null}
      </span>
      {hint ? <span className="text-xs text-text-muted">{hint}</span> : null}
    </div>
  )
}
