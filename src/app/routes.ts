import { ChefHat, CircleUserRound, Dumbbell, type LucideIcon, Salad, TrendingUp } from 'lucide-react'

/** The primary tabs, in navigation order. */
export const TAB_ROUTES = ['meals', 'kitchen', 'progress', 'activity', 'profile'] as const
export type TabRoute = (typeof TAB_ROUTES)[number]
export const DEFAULT_ROUTE: TabRoute = 'meals'

export interface TabMeta {
  route: TabRoute
  label: string
  /** One line for the desktop sidebar. */
  hint: string
  icon: LucideIcon
}

export const TABS: readonly TabMeta[] = [
  { route: 'meals', label: 'Meals', hint: 'Log food and see today', icon: Salad },
  { route: 'kitchen', label: 'Kitchen', hint: 'Plan meals from what you have', icon: ChefHat },
  { route: 'progress', label: 'Progress', hint: 'Weigh-ins and trend', icon: TrendingUp },
  { route: 'activity', label: 'Activity', hint: 'Workouts and weekly plan', icon: Dumbbell },
  { route: 'profile', label: 'Profile', hint: 'You, reminders and sync', icon: CircleUserRound },
]

export function isTabRoute(value: string): value is TabRoute {
  return (TAB_ROUTES as readonly string[]).includes(value)
}

export function hashFor(route: TabRoute): string {
  return `#/${route}`
}

export type ParsedHash =
  | { kind: 'empty' }
  /** A "#/<route>" path; `route` is null when the segment is not a known tab. */
  | { kind: 'route'; route: TabRoute | null }
  /** Anything else, e.g. an auth callback fragment ("#access_token=…", "#error=…"): leave it alone. */
  | { kind: 'other' }

/** Interprets `location.hash`. Only "#/segment[/…][?…]" is routing; other fragments are not ours. */
export function parseHash(hash: string): ParsedHash {
  const fragment = hash.startsWith('#') ? hash.slice(1) : hash
  if (fragment === '' || fragment === '/') return { kind: 'empty' }
  if (!fragment.startsWith('/')) return { kind: 'other' }
  const segment = fragment.slice(1).split(/[/?]/, 1)[0]?.toLowerCase() ?? ''
  // Email unsubscribe links are handled by App (outside the tabs): never rewrite them.
  if (segment === 'unsubscribe') return { kind: 'other' }
  return { kind: 'route', route: isTabRoute(segment) ? segment : null }
}

/** "#/unsubscribe?token=…": the page an email's unsubscribe link opens (works without signing in). */
export function unsubscribeTokenFromHash(hash: string): string | null {
  const match = /^#\/unsubscribe\?(.*)$/.exec(hash)
  if (!match) return null
  return new URLSearchParams(match[1] ?? '').get('token')
}

export function routeFromHash(hash: string): TabRoute {
  const parsed = parseHash(hash)
  return parsed.kind === 'route' && parsed.route ? parsed.route : DEFAULT_ROUTE
}
