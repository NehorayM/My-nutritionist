import { addDays, compareDateKeys, daysBetween, weekdayOf } from '@/domain/dates'
import type { Intensity } from '@/types'
import type { CatchUpCardioType } from './constants'
import type { CatchUpStatus } from './types'

/**
 * User-facing catch-up copy. Neutral and specific; it talks about sessions, days and recovery only —
 * never about food, calories or "making up" for anything.
 */

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const
const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'] as const

const CARDIO_LABELS: Record<CatchUpCardioType, Record<'light' | 'moderate', string>> = {
  walk: { moderate: 'brisk walk', light: 'easy walk' },
  run: { moderate: 'steady run', light: 'easy run' },
  cycling: { moderate: 'bike ride', light: 'easy bike ride' },
  swimming: { moderate: 'swim', light: 'easy swim' },
  cardio: { moderate: 'cardio session', light: 'easy cardio session' },
}

export type SuggestedType = 'strength' | CatchUpCardioType

export interface SuggestionFacts {
  date: string
  type: SuggestedType
  durationMin: number
  intensity: Extract<Intensity, 'light' | 'moderate'>
  /** Most recent strength or hard session before this date (logged, scheduled or suggested earlier). */
  lastDemandingDate: string | null
  /** What the previous day held, if anything relevant. */
  dayBefore: 'hard' | 'strength' | null
}

export interface TextContext {
  today: string
  weekStart: string
  /** Planned sessions still without a logged or scheduled session this week. */
  remaining: number
  /** Describe strength as full-body (two or fewer strength sessions planned per week). */
  fullBody: boolean
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function countWord(count: number): string {
  return NUMBER_WORDS[count] ?? String(count)
}

/** "the remaining session" / "the remaining three sessions". */
function remainingPhrase(count: number): string {
  return count === 1 ? 'the remaining session' : `the remaining ${countWord(count)} sessions`
}

/** "today", "tomorrow" or "on Friday". */
export function whenPhrase(date: string, today: string): string {
  if (date === today) return 'today'
  if (date === addDays(today, 1)) return 'tomorrow'
  return `on ${WEEKDAYS[weekdayOf(date)]}`
}

/** Possessive reference to an earlier or later day: "today's", "yesterday's", "last Sunday's", "Wednesday's". */
function dayPossessive(date: string, context: TextContext): string {
  if (date === context.today) return "today's"
  if (date === addDays(context.today, -1)) return "yesterday's"
  if (date === addDays(context.today, 1)) return "tomorrow's"
  const name = WEEKDAYS[weekdayOf(date)]
  return compareDateKeys(date, context.weekStart) < 0 ? `last ${name}'s` : `${name}'s`
}

function remainingSentence(remaining: number): string {
  const verb = remaining === 1 ? 'remains' : 'remain'
  return `${capitalize(countWord(remaining))} planned ${remaining === 1 ? 'session' : 'sessions'} ${verb} this week.`
}

function strengthClause(facts: SuggestionFacts, context: TextContext): string {
  if (facts.lastDemandingDate !== null) {
    const gap = daysBetween(facts.lastDemandingDate, facts.date)
    if (gap >= 2 && gap <= 6) {
      const rest = gap === 2 ? 'a recovery day' : `${countWord(gap - 1)} recovery days`
      return `leaves ${rest} after ${dayPossessive(facts.lastDemandingDate, context)} session`
    }
  }
  return 'keeps your strength sessions well spaced'
}

function cardioClause(facts: SuggestionFacts, context: TextContext): string {
  const before = dayPossessive(addDays(facts.date, -1), context)
  if (facts.dayBefore === 'hard') return `keeps the effort easy after ${before} harder session`
  if (facts.dayBefore === 'strength') return `adds some cardio after ${before} strength session`
  return 'keeps your weekly cardio steady'
}

export function sessionLabel(type: SuggestedType, intensity: 'light' | 'moderate', fullBody: boolean): string {
  if (type === 'strength') return fullBody ? 'full-body strength session' : 'strength session'
  return CARDIO_LABELS[type][intensity]
}

/** e.g. "Two planned sessions remain this week. A 40-minute full-body strength session on Friday leaves a recovery day after Wednesday's session." */
export function rationaleFor(facts: SuggestionFacts, context: TextContext): string {
  const label = sessionLabel(facts.type, facts.intensity, context.fullBody)
  const clause = facts.type === 'strength' ? strengthClause(facts, context) : cardioClause(facts, context)
  return `${remainingSentence(context.remaining)} A ${facts.durationMin}-minute ${label} ${whenPhrase(facts.date, context.today)} ${clause}.`
}

export interface MessageCounts {
  /** Sessions that still needed a day (planned remaining minus already scheduled). */
  needed: number
  /** Sessions that fit safely this week (ignoring dismissals). */
  placed: number
  deferred: number
  /** Suggestions actually shown (fewer than `placed` when the user dismissed some). */
  shown: number
  /** Free candidate days left this week, today included. */
  freeDays: number
}

function dismissalNote(counts: MessageCounts): string {
  if (counts.shown >= counts.placed) return ''
  return counts.shown === 0
    ? ' You dismissed the suggestions for this week; you can still log a session whenever it suits you.'
    : ' Suggestions you dismissed stay hidden.'
}

function limitedMessage(counts: MessageCounts): string {
  const carryOver = 'can carry over to next week — rest is part of the plan.'
  if (counts.placed === 0) {
    const reason =
      counts.freeDays === 0
        ? 'No free days are left this week.'
        : "The days left this week don't leave enough recovery time."
    return `${reason} ${capitalize(remainingPhrase(counts.deferred))} ${carryOver}`
  }
  const verb = counts.placed === 1 ? 'fits' : 'fit'
  return `${capitalize(countWord(counts.placed))} of the ${countWord(counts.needed)} remaining sessions ${verb} safely this week. The other ${countWord(counts.deferred)} ${carryOver}`
}

/** Summary line shown above the suggestions. */
export function catchUpMessage(status: CatchUpStatus, counts: MessageCounts): string {
  switch (status) {
    case 'no_plan':
      return 'No strength or cardio sessions are planned for this week. Set a weekly plan in Profile to see suggestions.'
    case 'complete':
      return 'Every planned session for this week is done. Nice consistency.'
    case 'on_track':
      if (counts.needed === 0) return 'Your remaining sessions are already scheduled for this week.'
      return counts.shown === 0
        ? `You're on track this week.${dismissalNote(counts)}`
        : `You're on track this week. Here's one way to fit ${remainingPhrase(counts.needed)}.${dismissalNote(counts)}`
    case 'catch_up': {
      const spread =
        counts.shown === 0
          ? ''
          : counts.needed === 1
            ? " Here's a day that fits around your recovery."
            : ' These suggestions spread them out with recovery days in between.'
      return `${remainingSentence(counts.needed)}${spread}${dismissalNote(counts)}`
    }
    case 'limited':
      return `${limitedMessage(counts)}${dismissalNote(counts)}`
  }
}
