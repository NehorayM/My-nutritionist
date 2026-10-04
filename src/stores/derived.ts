import { useMemo } from 'react'
import { calculateDailyTargets, type DailyTargets } from '@/domain/nutrition'
import { useProfileStore } from './profileStore'
import { latestWeightKg, useWeightStore } from './weightStore'

/** Daily targets for `date`, derived from the profile and the latest weigh-in (never stored). */
export function useDailyTargets(date: string): DailyTargets {
  const profile = useProfileStore((s) => s.profile)
  const weights = useWeightStore((s) => s.entries)
  return useMemo(
    () => calculateDailyTargets({ profile, date, latestWeightKg: latestWeightKg(weights, date) }),
    [profile, weights, date],
  )
}
