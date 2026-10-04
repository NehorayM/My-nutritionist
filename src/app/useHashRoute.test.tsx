import { act, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { parseHash, routeFromHash } from './routes'
import { useHashRoute } from './useHashRoute'

function Probe() {
  const { route, navigate } = useHashRoute()
  return (
    <>
      <p data-testid="route">{route}</p>
      <button type="button" onClick={() => navigate('activity')}>
        Go to activity
      </button>
      <button type="button" onClick={() => navigate('profile', { replace: true })}>
        Replace with profile
      </button>
    </>
  )
}

function currentRoute(): string | null {
  return screen.getByTestId('route').textContent
}

beforeEach(() => {
  window.history.replaceState(null, '', '/')
})

describe('useHashRoute', () => {
  it('defaults to meals without a hash', () => {
    render(<Probe />)
    expect(currentRoute()).toBe('meals')
    expect(window.location.hash).toBe('')
  })

  it('reads the initial tab from the hash', () => {
    window.history.replaceState(null, '', '/#/progress')
    render(<Probe />)
    expect(currentRoute()).toBe('progress')
  })

  it('normalizes unknown routes to #/meals and keeps the query string', () => {
    window.history.replaceState(null, '', '/?code=abc123&type=signup#/settings')
    render(<Probe />)
    expect(currentRoute()).toBe('meals')
    expect(window.location.hash).toBe('#/meals')
    expect(window.location.search).toBe('?code=abc123&type=signup')
  })

  it('leaves non-route fragments such as auth callbacks untouched', () => {
    window.history.replaceState(null, '', '/#access_token=xyz&type=recovery')
    render(<Probe />)
    expect(currentRoute()).toBe('meals')
    expect(window.location.hash).toBe('#access_token=xyz&type=recovery')
  })

  it('pushes history entries so Back and Forward move between tabs', async () => {
    render(<Probe />)
    act(() => screen.getByRole('button', { name: 'Go to activity' }).click())
    await waitFor(() => expect(currentRoute()).toBe('activity'))
    expect(window.location.hash).toBe('#/activity')

    act(() => window.history.back())
    await waitFor(() => expect(currentRoute()).toBe('meals'))

    act(() => window.history.forward())
    await waitFor(() => expect(currentRoute()).toBe('activity'))
  })

  it('can replace the current entry without adding history', async () => {
    window.history.replaceState(null, '', '/?keep=1#/meals')
    const before = window.history.length
    render(<Probe />)
    act(() => screen.getByRole('button', { name: 'Replace with profile' }).click())
    expect(currentRoute()).toBe('profile')
    expect(window.location.search).toBe('?keep=1')
    expect(window.history.length).toBe(before)
  })

  it('follows hash changes made elsewhere, normalizing unknown ones', async () => {
    render(<Probe />)
    act(() => {
      window.location.hash = '#/profile'
    })
    await waitFor(() => expect(currentRoute()).toBe('profile'))
    act(() => {
      window.location.hash = '#/nope'
    })
    await waitFor(() => expect(window.location.hash).toBe('#/meals'))
    expect(currentRoute()).toBe('meals')
  })
})

describe('parseHash / routeFromHash', () => {
  it('parses route paths, sub-paths and query suffixes', () => {
    expect(parseHash('')).toEqual({ kind: 'empty' })
    expect(parseHash('#/')).toEqual({ kind: 'empty' })
    expect(parseHash('#/progress')).toEqual({ kind: 'route', route: 'progress' })
    expect(parseHash('#/Activity/week?x=1')).toEqual({ kind: 'route', route: 'activity' })
    expect(parseHash('#/meals?date=2026-10-03')).toEqual({ kind: 'route', route: 'meals' })
    expect(parseHash('#/unknown')).toEqual({ kind: 'route', route: null })
    expect(parseHash('#error=access_denied')).toEqual({ kind: 'other' })
  })

  it('falls back to meals', () => {
    expect(routeFromHash('#/profile')).toBe('profile')
    expect(routeFromHash('#/unknown')).toBe('meals')
    expect(routeFromHash('#access_token=1')).toBe('meals')
  })
})
