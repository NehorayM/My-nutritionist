import type { NutrientTotal } from '@/types'
import { NUMERIC_TOLERANCE } from './constants'
import type { NutrientStatus, NutrientTarget } from './types'

const below = (value: number, bound: number): boolean => value < bound - NUMERIC_TOLERANCE
const above = (value: number, bound: number): boolean => value > bound + NUMERIC_TOLERANCE

/**
 * Status of one nutrient against its target (values in the nutrient's unit):
 * - unknown:  nothing known yet but at least one logged item lacks the value (knownCount 0, missingCount > 0).
 * - energy:   under when below `min`, over when above `max`, otherwise on_track
 *             (a missing bound falls back to `amount`).
 * - goal:     met when ≥ amount (over when above `max`, if set), otherwise under.
 * - limit:    over when above `max` (or `amount` when no max), otherwise on_track.
 * With nothing logged at all (no items) the value is 0: energy/goals read "under", limits "on_track".
 * Bounds are compared with NUMERIC_TOLERANCE so float sums such as 99.99999999999999 count as 100.
 */
export function nutrientStatus(target: NutrientTarget, consumed: NutrientTotal): NutrientStatus {
  if (consumed.knownCount === 0 && consumed.missingCount > 0) return 'unknown'
  const value = consumed.value
  switch (target.kind) {
    case 'energy': {
      if (below(value, target.min ?? target.amount)) return 'under'
      if (above(value, target.max ?? target.amount)) return 'over'
      return 'on_track'
    }
    case 'goal': {
      if (target.max !== null && above(value, target.max)) return 'over'
      return below(value, target.amount) ? 'under' : 'met'
    }
    case 'limit':
      return above(value, target.max ?? target.amount) ? 'over' : 'on_track'
  }
}
