import { CircleUserRound, Dumbbell, type LucideIcon, Salad, TrendingUp } from 'lucide-react'

/** The four primary tabs, in bottom-bar order. */
export const TAB_ROUTES = ['meals', 'progress', 'activity', 'profile'] as const
export type TabRoute = (typeof TAB_ROUTES)[number]
export const DEFAULT_ROUTE: TabRoute = 'meals'

export interface TabMeta {
  route: TabRoute
  label: string
  icon: LucideIcon
}

export const TABS: readonly TabMeta[] = [
  { route: 'meals', label: 'Meals', icon: Salad },
  { route: 'progress', label: 'Progress', icon: TrendingUp },
  { route: 'activity', label: 'Activity', icon: Dumbbell },
  { route: 'profile', label: 'Profile', icon: CircleUserRound },
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
  return { kind: 'route', route: isTabRoute(segment) ? segment : null }
}

export function routeFromHash(hash: string): TabRoute {
  const parsed = parseHash(hash)
  return parsed.kind === 'route' && parsed.route ? parsed.route : DEFAULT_ROUTE
}
