import { describe, expect, it } from 'vitest'
import { createChangeJournal } from './changeJournal'

type Rec = { id: string; day: string; v: number }
const rec = (id: string, day: string, v: number): Rec => ({ id, day, v })

describe('change journal', () => {
  it('returns the list unchanged when nothing happened after the mark', () => {
    const journal = createChangeJournal<Rec>()
    journal.record('a', rec('a', 'mon', 1))
    const mark = journal.mark()
    expect(journal.overlay([rec('b', 'mon', 2)], mark)).toEqual([rec('b', 'mon', 2)])
    expect(journal.changedSince(mark)).toBe(false)
  })

  it('applies upserts and removals recorded after the mark, in order', () => {
    const journal = createChangeJournal<Rec>()
    const mark = journal.mark()
    journal.record('a', rec('a', 'mon', 1))
    journal.record('b', null)
    journal.record('a', rec('a', 'mon', 3))
    const loaded = [rec('b', 'mon', 2), rec('c', 'mon', 4)]
    expect(journal.overlay(loaded, mark)).toEqual([rec('c', 'mon', 4), rec('a', 'mon', 3)])
    expect(journal.changedSince(mark)).toBe(true)
  })

  it('removes records that moved out of the loaded scope', () => {
    const journal = createChangeJournal<Rec>()
    const mark = journal.mark()
    journal.record('a', rec('a', 'tue', 5))
    const onMonday = (r: Rec) => r.day === 'mon'
    expect(journal.overlay([rec('a', 'mon', 1)], mark, onMonday)).toEqual([])
  })

  it('keeps only the most recent changes (bounded memory) and survives clear()', () => {
    const journal = createChangeJournal<Rec>(2)
    const mark = journal.mark()
    journal.record('a', rec('a', 'mon', 1))
    journal.record('b', rec('b', 'mon', 2))
    journal.record('c', rec('c', 'mon', 3))
    expect(journal.overlay([], mark).map((r) => r.id)).toEqual(['b', 'c'])
    journal.clear()
    expect(journal.overlay([], mark)).toEqual([])
    expect(journal.mark()).toBe(3)
  })
})
