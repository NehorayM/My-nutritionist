import type { ReactNode } from 'react'
import { cn } from './cn'
import { measureProgress, progressAria } from './progressMath'
import { TONE_FILL, type Tone } from './tones'

interface ProgressBarProps {
  /** Current amount; null = unknown. */
  value: number | null
  /** Target / reference amount; null or ≤ 0 = no target. */
  max: number | null
  /** Accessible name, e.g. "Protein". */
  label: string
  /** Spoken value, e.g. "62 of 110 g". Required: raw numbers lack units, and amounts above the target live here. */
  valueText: string
  tone?: Tone
  size?: 'sm' | 'md' | 'lg'
  /** Optional visible caption rendered above the bar (label + numbers). */
  caption?: ReactNode
  className?: string
}

const HEIGHTS = { sm: 'h-1.5', md: 'h-2.5', lg: 'h-3.5' } as const

/**
 * Horizontal progress toward a target (role="progressbar"). The fill caps at 100%; above the target
 * the part of the amount beyond it becomes a striped tail after a notch (e.g. 2,500 of 2,000 → the
 * last 20% is striped) — never red: going over is information, not an error.
 * aria-valuenow is clamped to the target, so `valueText` must carry the real amount.
 */
export function ProgressBar({ value, max, label, valueText, tone = 'primary', size = 'md', caption, className }: ProgressBarProps) {
  const progress = measureProgress(value, max)

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {caption}
      <div
        {...progressAria(value, max)}
        aria-label={label}
        aria-valuetext={valueText}
        data-over={progress.isOver || undefined}
        className={cn('relative w-full overflow-hidden rounded-full bg-text/8', HEIGHTS[size])}
      >
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-500 ease-out-soft motion-reduce:transition-none',
            TONE_FILL[tone],
          )}
          style={{ width: `${progress.fraction * 100}%` }}
        />
        {progress.isOver ? (
          <div
            data-testid="progress-over"
            className="stripes absolute inset-y-0 right-0 rounded-r-full border-l-2 border-surface"
            style={{ width: `${Math.max(6, progress.overShare * 100)}%` }}
          />
        ) : null}
      </div>
    </div>
  )
}
