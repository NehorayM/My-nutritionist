import { act, render, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetUiStore, useUiStore } from '@/stores/uiStore'
import { DARK_SCHEME_QUERY, THEME_COLORS, resolveTheme, useApplyTheme } from './useApplyTheme'
import { useDebouncedValue } from './useDebouncedValue'
import { useMediaQuery } from './useMediaQuery'
import { useOnlineStatus } from './useOnlineStatus'
import { REDUCED_MOTION_QUERY, usePrefersReducedMotion } from './usePrefersReducedMotion'
import { installMatchMedia } from './testMediaQuery'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('useDebouncedValue', () => {
  it('only publishes the value after it stops changing', () => {
    vi.useFakeTimers()
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: 'ap' },
    })
    expect(result.current).toBe('ap')
    rerender({ value: 'app' })
    act(() => vi.advanceTimersByTime(200))
    rerender({ value: 'appl' })
    act(() => vi.advanceTimersByTime(200))
    expect(result.current).toBe('ap')
    act(() => vi.advanceTimersByTime(100))
    expect(result.current).toBe('appl')
  })

  it('defaults to the 350 ms search debounce', () => {
    vi.useFakeTimers()
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value), { initialProps: { value: 1 } })
    rerender({ value: 2 })
    act(() => vi.advanceTimersByTime(349))
    expect(result.current).toBe(1)
    act(() => vi.advanceTimersByTime(1))
    expect(result.current).toBe(2)
  })
})

describe('useOnlineStatus', () => {
  it('follows online/offline events', () => {
    const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
    const { result } = renderHook(() => useOnlineStatus())
    expect(result.current).toBe(true)
    onLine.mockReturnValue(false)
    act(() => {
      window.dispatchEvent(new Event('offline'))
    })
    expect(result.current).toBe(false)
    onLine.mockReturnValue(true)
    act(() => {
      window.dispatchEvent(new Event('online'))
    })
    expect(result.current).toBe(true)
  })
})

describe('useMediaQuery / usePrefersReducedMotion', () => {
  it('tracks a media query and unsubscribes on unmount', () => {
    const media = installMatchMedia({ [REDUCED_MOTION_QUERY]: false })
    const { result, unmount } = renderHook(() => usePrefersReducedMotion())
    expect(result.current).toBe(false)
    act(() => media.set(REDUCED_MOTION_QUERY, true))
    expect(result.current).toBe(true)
    unmount()
    expect(media.listenerCount(REDUCED_MOTION_QUERY)).toBe(0)
  })

  it('returns false when matchMedia is unavailable', () => {
    vi.stubGlobal('matchMedia', undefined)
    const { result } = renderHook(() => useMediaQuery('(min-width: 40rem)'))
    expect(result.current).toBe(false)
  })
})

describe('theme', () => {
  beforeEach(() => {
    resetUiStore()
    document.head.innerHTML =
      '<meta name="theme-color" media="(prefers-color-scheme: light)" content="x"><meta name="theme-color" media="(prefers-color-scheme: dark)" content="y">'
    delete document.documentElement.dataset.theme
  })

  function ThemeProbe() {
    useApplyTheme()
    return null
  }

  function themeColors(): string[] {
    return Array.from(document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')).map((meta) => meta.content)
  }

  it('resolves the system preference', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })

  it('applies data-theme and theme-color, following the OS while on "system"', () => {
    const media = installMatchMedia({ [DARK_SCHEME_QUERY]: false })
    render(<ThemeProbe />)
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(themeColors()).toEqual([THEME_COLORS.light, THEME_COLORS.light])

    act(() => media.set(DARK_SCHEME_QUERY, true))
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(themeColors()).toEqual([THEME_COLORS.dark, THEME_COLORS.dark])
  })

  it('lets an explicit preference override the OS', () => {
    const media = installMatchMedia({ [DARK_SCHEME_QUERY]: true })
    render(<ThemeProbe />)
    act(() => useUiStore.getState().setTheme('light'))
    expect(document.documentElement.dataset.theme).toBe('light')
    act(() => media.set(DARK_SCHEME_QUERY, false))
    act(() => useUiStore.getState().setTheme('dark'))
    expect(document.documentElement.dataset.theme).toBe('dark')
  })
})
