export interface ProgressMeasure {
  /** Fill fraction for drawing, clamped to 0…1. */
  fraction: number
  /** Value above the target (0 when at or under). */
  over: number
  isOver: boolean
  /** Overflow relative to the target, clamped to 0…1 (one extra lap at most). */
  overFraction: number
  /** Share of the whole amount that lies above the target (0…1): the striped tail of a bar. */
  overShare: number
  /** False when value or target is unknown/non-positive target: nothing to compare. */
  determinate: boolean
}

export function measureProgress(value: number | null, max: number | null): ProgressMeasure {
  if (value === null || max === null || !Number.isFinite(value) || !Number.isFinite(max) || max <= 0) {
    return { fraction: 0, over: 0, isOver: false, overFraction: 0, overShare: 0, determinate: false }
  }
  const safeValue = Math.max(0, value)
  const over = Math.max(0, safeValue - max)
  return {
    fraction: Math.min(1, safeValue / max),
    over,
    isOver: over > 0,
    overFraction: Math.min(1, over / max),
    overShare: over > 0 ? over / safeValue : 0,
    determinate: true,
  }
}

export interface ProgressAria {
  role: 'progressbar'
  'aria-valuemin'?: number
  'aria-valuemax'?: number
  'aria-valuenow'?: number
}

/**
 * ARIA range values for a progress indicator. `aria-valuenow` is clamped to 0…max (ARIA requires
 * it to stay inside the range), so amounts above the target must be spoken through aria-valuetext.
 * Unknown value or target → indeterminate (no valuenow).
 */
export function progressAria(value: number | null, max: number | null): ProgressAria {
  const progress = measureProgress(value, max)
  if (!progress.determinate || value === null || max === null) return { role: 'progressbar' }
  return {
    role: 'progressbar',
    'aria-valuemin': 0,
    'aria-valuemax': max,
    'aria-valuenow': Math.min(Math.max(0, value), max),
  }
}
