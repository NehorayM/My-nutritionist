export const WEIGHT_UNITS = ['kg', 'lb'] as const
export type WeightUnit = (typeof WEIGHT_UNITS)[number]

export interface WeightEntry {
  id: string
  userId: string
  /** Local calendar date YYYY-MM-DD of the measurement. */
  date: string
  /** ISO timestamp of the measurement. */
  measuredAt: string
  /** Canonical value in kilograms. */
  weightKg: number
  /** Unit the user entered the value in (for display fidelity). */
  inputUnit: WeightUnit
  note: string | null
  createdAt: string
  updatedAt: string
}
