import { addDays, daysBetween, eachDay } from '@/domain/dates'
import { ACTIVITY_CATEGORIES } from '@/types'
import type { ActivityCategory } from '@/types'
import { loadByDate, needsRecoveryAfter } from './recovery'
import type { DayLoad, SessionEvent } from './recovery'

/** One suggested session: a category on a free day. Suggestions are always light or moderate. */
export interface PlannedSlot {
  date: string
  category: ActivityCategory
}

export interface ScheduleRequest {
  /** Free candidate dates in ascending order; each can hold at most one session. */
  days: readonly string[]
  /** Sessions still to place per category. */
  need: Readonly<Record<ActivityCategory, number>>
  /** Sessions that already exist (logged or scheduled). They constrain the plan but never move. */
  fixed: readonly SessionEvent[]
  /** Slots that must not be used, e.g. suggestions the user dismissed. */
  isBlocked?: (slot: PlannedSlot) => boolean
}

/**
 * Free days from `today` to `end`: today is skipped when something is already logged or planned for it,
 * and so is every later day that already holds a session (one session per day).
 */
export function candidateDays(today: string, end: string, occupied: ReadonlySet<string>): string[] {
  return eachDay(today, end).filter((date) => !occupied.has(date))
}

function placeable(slot: PlannedSlot, chosen: readonly PlannedSlot[], loads: ReadonlyMap<string, DayLoad>): boolean {
  if (slot.category !== 'strength') return true
  const before = addDays(slot.date, -1)
  if (needsRecoveryAfter(loads.get(before)) || needsRecoveryAfter(loads.get(addDays(slot.date, 1)))) return false
  const previous = chosen[chosen.length - 1]
  return !(previous && previous.date === before && previous.category === 'strength')
}

function enumerateMaximal(request: ScheduleRequest, loads: ReadonlyMap<string, DayLoad>): PlannedSlot[][] {
  const { days, need, isBlocked } = request
  const results: PlannedSlot[][] = []
  const used: Record<ActivityCategory, number> = { strength: 0, cardio: 0 }
  const chosen: PlannedSlot[] = []
  let best = 0

  const visit = (index: number): void => {
    if (chosen.length + (days.length - index) < best) return
    const date = days[index]
    if (date === undefined) {
      if (chosen.length > best) {
        best = chosen.length
        results.length = 0
      }
      results.push([...chosen])
      return
    }
    for (const category of ACTIVITY_CATEGORIES) {
      const slot = { date, category }
      if (used[category] >= need[category] || !placeable(slot, chosen, loads) || isBlocked?.(slot)) continue
      chosen.push(slot)
      used[category] += 1
      visit(index + 1)
      chosen.pop()
      used[category] -= 1
    }
    visit(index + 1)
  }

  visit(0)
  return results
}

/**
 * Preference key, lower is better:
 * 1. deferral balance — when not everything fits, defer evenly across categories;
 * 2. alternation — fewer consecutive suggestions of the same category;
 * 3. spacing — fewer suggestions directly next to another session;
 * 4. promptness — earlier days first.
 */
function preferenceKey(slots: readonly PlannedSlot[], request: ScheduleRequest, loads: ReadonlyMap<string, DayLoad>): number[] {
  const first = request.days[0] ?? ''
  let deferralBalance = 0
  for (const category of ACTIVITY_CATEGORIES) {
    const deferred = request.need[category] - slots.filter((slot) => slot.category === category).length
    deferralBalance += deferred * deferred
  }
  let repeats = 0
  let adjacent = 0
  let lateness = 0
  slots.forEach((slot, index) => {
    const previous = slots[index - 1]
    if (previous?.category === slot.category) repeats += 1
    const before = addDays(slot.date, -1)
    if (loads.has(before) || previous?.date === before) adjacent += 1
    if (loads.has(addDays(slot.date, 1))) adjacent += 1
    lateness += daysBetween(first, slot.date)
  })
  return [deferralBalance, repeats, adjacent, lateness]
}

const CATEGORY_CODE: Record<ActivityCategory, string> = { strength: 'a', cardio: 'b' }

/** Final tie-break: earlier dates first, strength before cardio on the same date. Plans are always distinct. */
function signature(slots: readonly PlannedSlot[]): string {
  return slots.map((slot) => `${slot.date}${CATEGORY_CODE[slot.category]}`).join('|')
}

function compareKeys(a: readonly number[], b: readonly number[]): number {
  for (let i = 0; i < a.length; i += 1) {
    const diff = a[i]! - b[i]!
    if (diff !== 0) return diff
  }
  return 0
}

/**
 * Every way to place the most sessions that fit safely, best first (deterministic). Rules: at most one session
 * per free day; no strength session the day before or after a strength or hard session (48 h recovery);
 * suggestions are never vigorous, so hard days are never stacked. Always returns at least one (possibly empty) plan.
 */
export function rankSchedules(request: ScheduleRequest, limit: number): PlannedSlot[][] {
  const loads = loadByDate(request.fixed)
  return enumerateMaximal(request, loads)
    .map((slots) => ({ slots, key: preferenceKey(slots, request, loads), id: signature(slots) }))
    .sort((a, b) => compareKeys(a.key, b.key) || Number(a.id > b.id) - Number(a.id < b.id))
    .slice(0, Math.max(1, limit))
    .map((entry) => entry.slots)
}

/** Largest number of the needed sessions that fit safely into the free days. */
export function maxPlaceable(request: ScheduleRequest): number {
  return rankSchedules(request, 1).reduce((most, slots) => Math.max(most, slots.length), 0)
}
