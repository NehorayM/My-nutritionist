import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DISMISSAL_RETENTION_DAYS, UI_STORAGE_KEY, pruneDismissalMap, resetUiStore, useUiStore } from './uiStore'

function storedState(): Record<string, unknown> {
  const raw = localStorage.getItem(UI_STORAGE_KEY)
  if (!raw) throw new Error('nothing persisted')
  return (JSON.parse(raw) as { state: Record<string, unknown> }).state
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 10, 9, 0))
  resetUiStore()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('theme preference', () => {
  it('defaults to system and persists explicit choices', () => {
    expect(useUiStore.getState().theme).toBe('system')
    useUiStore.getState().setTheme('dark')
    expect(useUiStore.getState().theme).toBe('dark')
    expect(storedState().theme).toBe('dark')
  })

  it('rehydrates a stored preference', async () => {
    localStorage.setItem(UI_STORAGE_KEY, JSON.stringify({ state: { theme: 'light' }, version: 1 }))
    await useUiStore.persist.rehydrate()
    expect(useUiStore.getState().theme).toBe('light')
  })

  it('ignores invalid stored values and keeps the current state', async () => {
    localStorage.setItem(
      UI_STORAGE_KEY,
      JSON.stringify({ state: { theme: 'neon', dismissedRecommendations: 'oops' }, version: 1 }),
    )
    await useUiStore.persist.rehydrate()
    expect(useUiStore.getState().theme).toBe('system')
    expect(useUiStore.getState().dismissedRecommendations).toEqual({})

    useUiStore.getState().setTheme('dark')
    localStorage.setItem(UI_STORAGE_KEY, JSON.stringify({ state: null, version: 1 }))
    await useUiStore.persist.rehydrate()
    expect(useUiStore.getState().theme).toBe('dark')
  })

  it('keeps working in memory when storage throws', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError')
    })
    expect(() => useUiStore.getState().setTheme('light')).not.toThrow()
    expect(useUiStore.getState().theme).toBe('light')
    expect(setItem).toHaveBeenCalled()
  })

  it('survives a storage read error during rehydration', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError')
    })
    useUiStore.getState().setTheme('dark')
    await expect(useUiStore.persist.rehydrate()).resolves.toBeUndefined()
    expect(useUiStore.getState().theme).toBe('dark')
  })
})

describe('recommendation dismissals', () => {
  it('records ids per date without duplicates', () => {
    const { dismissRecommendation } = useUiStore.getState()
    dismissRecommendation('2026-10-10', 'balanced-1')
    dismissRecommendation('2026-10-10', 'balanced-1')
    dismissRecommendation('2026-10-10', 'quick-2')
    dismissRecommendation('2026-10-09', 'light-1')

    const { dismissedFor } = useUiStore.getState()
    expect(dismissedFor('2026-10-10')).toEqual(['balanced-1', 'quick-2'])
    expect(dismissedFor('2026-10-09')).toEqual(['light-1'])
    expect(storedState().dismissedRecommendations).toEqual({
      '2026-10-10': ['balanced-1', 'quick-2'],
      '2026-10-09': ['light-1'],
    })
  })

  it('returns the same empty reference for dates without dismissals', () => {
    const { dismissedFor } = useUiStore.getState()
    expect(dismissedFor('2026-10-01')).toEqual([])
    expect(dismissedFor('2026-10-01')).toBe(dismissedFor('2026-10-02'))
  })

  it('restores a dismissed id (undo) and removes empty dates', () => {
    const state = useUiStore.getState()
    state.dismissRecommendation('2026-10-10', 'a')
    state.dismissRecommendation('2026-10-10', 'b')
    state.restoreRecommendation('2026-10-10', 'a')
    expect(useUiStore.getState().dismissedFor('2026-10-10')).toEqual(['b'])
    state.restoreRecommendation('2026-10-10', 'b')
    expect(useUiStore.getState().dismissedRecommendations).toEqual({})
    const before = useUiStore.getState().dismissedRecommendations
    state.restoreRecommendation('2026-10-10', 'missing')
    expect(useUiStore.getState().dismissedRecommendations).toBe(before)
  })

  it(`prunes dates older than ${DISMISSAL_RETENTION_DAYS} days when dismissing`, () => {
    useUiStore.setState({
      dismissedRecommendations: { '2026-09-25': ['old'], '2026-09-26': ['edge'], 'garbage': ['x'] },
    })
    useUiStore.getState().dismissRecommendation('2026-10-10', 'new')
    expect(useUiStore.getState().dismissedRecommendations).toEqual({
      '2026-09-26': ['edge'],
      '2026-10-10': ['new'],
    })
  })

  it('prunes on rehydration', async () => {
    localStorage.setItem(
      UI_STORAGE_KEY,
      JSON.stringify({
        state: { theme: 'dark', dismissedRecommendations: { '2026-01-01': ['stale'], '2026-10-09': ['fresh'] } },
        version: 1,
      }),
    )
    await useUiStore.persist.rehydrate()
    expect(useUiStore.getState().dismissedRecommendations).toEqual({ '2026-10-09': ['fresh'] })
    expect(useUiStore.getState().dismissedCatchUps).toEqual({})
  })
})

describe('catch-up dismissals', () => {
  it('records ids per week start and prunes old weeks', () => {
    useUiStore.setState({ dismissedCatchUps: { '2026-09-14': ['old-week'] } })
    const state = useUiStore.getState()
    state.dismissCatchUp('2026-10-05', 'cardio-tue')
    state.dismissCatchUp('2026-10-05', 'strength-thu')
    expect(useUiStore.getState().dismissedCatchUpsFor('2026-10-05')).toEqual(['cardio-tue', 'strength-thu'])
    expect(useUiStore.getState().dismissedCatchUps).not.toHaveProperty('2026-09-14')

    state.restoreCatchUp('2026-10-05', 'cardio-tue')
    expect(useUiStore.getState().dismissedCatchUpsFor('2026-10-05')).toEqual(['strength-thu'])
    expect(useUiStore.getState().dismissedCatchUpsFor('2026-09-28')).toEqual([])
  })
})

describe('pruneDismissals / pruneDismissalMap', () => {
  it('prunes both maps relative to an explicit day', () => {
    useUiStore.setState({
      dismissedRecommendations: { '2026-10-01': ['a'], '2026-10-20': ['b'] },
      dismissedCatchUps: { '2026-10-05': ['c'], '2026-10-19': ['d'] },
    })
    useUiStore.getState().pruneDismissals('2026-10-25')
    expect(useUiStore.getState().dismissedRecommendations).toEqual({ '2026-10-20': ['b'] })
    expect(useUiStore.getState().dismissedCatchUps).toEqual({ '2026-10-19': ['d'] })
  })

  it('returns the same map when nothing is removed, across year boundaries', () => {
    const map = { '2025-12-25': ['x'], '2026-01-02': ['y'] }
    expect(pruneDismissalMap(map, '2026-01-08')).toBe(map)
    expect(pruneDismissalMap(map, '2026-01-09')).toEqual({ '2026-01-02': ['y'] })
  })

  it('drops empty id lists', () => {
    expect(pruneDismissalMap({ '2026-10-10': [] }, '2026-10-10')).toEqual({})
  })
})
