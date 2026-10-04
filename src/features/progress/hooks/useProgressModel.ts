import { useMemo } from 'react'
import { isMinor } from '@/domain/profile'
import {
  computeWeightStats,
  dailyWeightsThrough,
  isWeightChangeGoal,
  movingAverage,
  TREND_WINDOW_DAYS,
  weightGoalInput,
  type DailyWeight,
  type WeightGoalInput,
  type WeightStats,
} from '@/domain/weight'
import { useToday } from '@/hooks/useToday'
import { useProfileStore } from '@/stores/profileStore'
import { useWeightStore } from '@/stores/weightStore'
import type { Profile, WeightEntry } from '@/types'

export interface ProgressModel {
  profile: Profile
  entries: WeightEntry[]
  today: string
  minor: boolean
  goalInput: WeightGoalInput
  /** An adult with a weight-change goal: "distance to goal" applies. */
  tracksTarget: boolean
  /** Target used for "distance to goal" (null unless tracksTarget and a target is set). */
  activeTargetKg: number | null
  /** First day with a weigh-in (up to today), for "since …" copy. */
  firstDate: string | null
  stats: WeightStats
  /**
   * Weight the goal estimate starts from — today's 7-day trend, else the latest weigh-in, else the
   * profile's current weight (the same anchor the chart projection uses).
   */
  anchorKg: number | null
}

function trendAnchorKg(daily: readonly DailyWeight[], today: string): number | null {
  const trendToday = movingAverage(daily, TREND_WINDOW_DAYS, today).at(-1)?.trendKg ?? null
  return trendToday ?? daily.at(-1)?.weightKg ?? null
}

/** Everything the Progress screen derives from the profile and weigh-ins (weight engine only). */
export function useProgressModel(): ProgressModel | null {
  const profile = useProfileStore((s) => s.profile)
  const entries = useWeightStore((s) => s.entries)
  const today = useToday()

  return useMemo(() => {
    if (!profile) return null
    const goalInput = weightGoalInput(profile, today)
    const tracksTarget = goalInput.isAdult && isWeightChangeGoal(profile.goal)
    const activeTargetKg = tracksTarget ? profile.targetWeightKg : null
    const daily = dailyWeightsThrough(entries, today)
    return {
      profile,
      entries,
      today,
      minor: isMinor(profile, today),
      goalInput,
      tracksTarget,
      activeTargetKg,
      firstDate: daily[0]?.date ?? null,
      stats: computeWeightStats(entries, { targetWeightKg: activeTargetKg, today }),
      anchorKg: trendAnchorKg(daily, today) ?? profile.currentWeightKg,
    }
  }, [profile, entries, today])
}
