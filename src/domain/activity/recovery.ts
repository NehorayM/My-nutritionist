import { addDays, isDateKey } from '@/domain/dates'
import type { Intensity, WorkoutType } from '@/types'

/** Minimal shape of a logged or scheduled session that matters for recovery spacing. */
export interface SessionEvent {
  date: string
  type: WorkoutType
  intensity: Intensity | null
}

/** What happened on one calendar day, merged across all of its sessions. */
export interface DayLoad {
  strength: boolean
  /** A vigorous-intensity session (any type) or a HIIT session. */
  hard: boolean
}

/** HIIT is always treated as vigorous for recovery purposes, whatever intensity was logged. */
export function isHardSession(session: Pick<SessionEvent, 'type' | 'intensity'>): boolean {
  return session.intensity === 'vigorous' || session.type === 'hiit'
}

/** Day → load map; every valid event date is present, even for easy sessions. */
export function loadByDate(events: readonly SessionEvent[]): Map<string, DayLoad> {
  const map = new Map<string, DayLoad>()
  for (const event of events) {
    if (!isDateKey(event.date)) continue
    const current = map.get(event.date) ?? { strength: false, hard: false }
    map.set(event.date, {
      strength: current.strength || event.type === 'strength',
      hard: current.hard || isHardSession(event),
    })
  }
  return map
}

/** A strength session or a hard session on that day calls for a recovery day before more strength work. */
export function needsRecoveryAfter(load: DayLoad | undefined): boolean {
  return load !== undefined && (load.strength || load.hard)
}

/** True when the day before `date` had a hard (vigorous or HIIT) session. */
export function followsHardDay(date: string, loads: ReadonlyMap<string, DayLoad>): boolean {
  return loads.get(addDays(date, -1))?.hard === true
}
