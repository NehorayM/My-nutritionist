import type { ReactNode } from 'react'
import { cn } from './cn'
import { measureProgress, progressAria } from './progressMath'
import { TONE_STROKE, type Tone } from './tones'

interface ProgressRingProps {
  value: number | null
  max: number | null
  /** Accessible name, e.g. "Calories". */
  label: string
  /** Spoken value, e.g. "1,240 of 2,000 kcal". */
  valueText: string
  tone?: Tone
  /** Diameter in px. */
  size?: number
  /** Stroke width in px. */
  thickness?: number
  /** Content centered inside the ring (decorative duplicate of valueText is fine; it is aria-hidden). */
  children?: ReactNode
  className?: string
}

/**
 * Circular progress toward a target. Above the target the ring stays full and a second,
 * thinner lap shows the overflow (capped at one extra lap). Same semantics as ProgressBar:
 * role="progressbar", aria-valuenow clamped to the target, the real amount in `valueText`.
 */
export function ProgressRing({
  value,
  max,
  label,
  valueText,
  tone = 'energy',
  size = 160,
  thickness = 14,
  children,
  className,
}: ProgressRingProps) {
  const progress = measureProgress(value, max)
  const radius = (size - thickness) / 2
  const circumference = 2 * Math.PI * radius
  const overRadius = radius - thickness * 0.85
  const overCircumference = 2 * Math.PI * Math.max(0, overRadius)

  return (
    <div
      {...progressAria(value, max)}
      aria-label={label}
      aria-valuetext={valueText}
      data-over={progress.isOver || undefined}
      className={cn('relative inline-grid shrink-0 place-items-center', className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={thickness} className="stroke-text/8" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress.fraction)}
          className={cn(
            'transition-[stroke-dashoffset] duration-700 ease-out-soft motion-reduce:transition-none',
            TONE_STROKE[tone],
            progress.fraction === 0 && 'opacity-0',
          )}
        />
        {progress.isOver && overRadius > 0 ? (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={overRadius}
            fill="none"
            strokeWidth={Math.max(2, thickness * 0.35)}
            strokeLinecap="round"
            strokeDasharray={overCircumference}
            strokeDashoffset={overCircumference * (1 - progress.overFraction)}
            className={cn('opacity-60', TONE_STROKE[tone])}
          />
        ) : null}
      </svg>
      {children ? (
        <div aria-hidden="true" className="absolute inset-0 grid place-items-center text-center">
          {children}
        </div>
      ) : null}
    </div>
  )
}
