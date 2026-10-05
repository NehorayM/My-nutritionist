import type { Repositories } from '@/repositories/types'

/** Every date the app can store (DB checks keep dates inside this range). */
const ALL_DATES = { from: '1900-01-01', to: '2100-12-31' }

export interface DataExport {
  app: 'My-nutritionist'
  version: 1
  exportedAt: string
  userId: string
  profile: Awaited<ReturnType<Repositories['profile']['get']>>
  foods: Awaited<ReturnType<Repositories['foods']['list']>>
  meals: Awaited<ReturnType<Repositories['meals']['listRange']>>
  weights: Awaited<ReturnType<Repositories['weights']['list']>>
  workouts: Awaited<ReturnType<Repositories['workouts']['listRange']>>
  scheduledWorkouts: Awaited<ReturnType<Repositories['scheduledWorkouts']['listRange']>>
  favorites: Awaited<ReturnType<Repositories['favorites']['list']>>
  savedMeals: Awaited<ReturnType<Repositories['savedMeals']['list']>>
}

/** All of the current user's records, as one JSON-serializable document. */
export async function collectExport(repos: Repositories, now: Date): Promise<DataExport> {
  const [profile, foods, meals, weights, workouts, scheduledWorkouts, favorites, savedMeals] = await Promise.all([
    repos.profile.get(),
    repos.foods.list(),
    repos.meals.listRange(ALL_DATES),
    repos.weights.list(),
    repos.workouts.listRange(ALL_DATES),
    repos.scheduledWorkouts.listRange(ALL_DATES),
    repos.favorites.list(),
    repos.savedMeals.list(),
  ])
  return {
    app: 'My-nutritionist',
    version: 1,
    exportedAt: now.toISOString(),
    userId: repos.userId,
    profile,
    foods,
    meals,
    weights,
    workouts,
    scheduledWorkouts,
    favorites,
    savedMeals,
  }
}

/** Offers the export as a file download (no network involved). */
export function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
