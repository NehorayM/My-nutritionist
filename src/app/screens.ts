import { MealsScreen } from '@/features/meals/MealsScreen'
import { eagerScreen, lazyScreen, type ScreenEntry } from './lazyScreen'
import type { TabRoute } from './routes'

/**
 * Meals is the home tab and ships in the main bundle (no loading waterfall on start).
 * The other tabs are split; Progress in particular carries recharts.
 */
export const SCREENS: Record<TabRoute, ScreenEntry> = {
  meals: eagerScreen(MealsScreen),
  progress: lazyScreen(() => import('@/features/progress/ProgressScreen').then((m) => ({ default: m.ProgressScreen }))),
  activity: lazyScreen(() => import('@/features/activity/ActivityScreen').then((m) => ({ default: m.ActivityScreen }))),
  profile: lazyScreen(() => import('@/features/profile/ProfileScreen').then((m) => ({ default: m.ProfileScreen }))),
}
