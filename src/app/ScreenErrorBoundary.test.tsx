import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Suspense, type ComponentType } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { lazyScreen } from './lazyScreen'
import { ScreenErrorBoundary } from './ScreenErrorBoundary'

let shouldThrow = true

function Flaky() {
  if (shouldThrow) throw new Error('render failed')
  return <p>Weekly plan</p>
}

beforeEach(() => {
  shouldThrow = true
  // React reports errors caught by boundaries to console.error; keep test output clean.
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

describe('ScreenErrorBoundary', () => {
  it('shows an ErrorState for a crashing screen and recovers with "Try again"', async () => {
    render(
      <>
        <ScreenErrorBoundary screenName="Activity">
          <Flaky />
        </ScreenErrorBoundary>
        <a href="#/meals">Meals</a>
      </>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent("Activity couldn't be shown")
    expect(screen.getByRole('link', { name: 'Meals' })).toBeInTheDocument()

    shouldThrow = false
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(screen.getByText('Weekly plan')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('keeps showing the error if the retry fails again', async () => {
    render(
      <ScreenErrorBoundary screenName="Activity">
        <Flaky />
      </ScreenErrorBoundary>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
})

describe('lazyScreen', () => {
  it('re-requests a chunk that failed to load when the user retries', async () => {
    let online = false
    const load = vi.fn<() => Promise<{ default: ComponentType }>>(() =>
      online
        ? Promise.resolve({ default: () => <h1>Progress</h1> })
        : Promise.reject(new TypeError('Failed to fetch dynamically imported module')),
    )
    const { Component } = lazyScreen(load)

    render(
      <ScreenErrorBoundary screenName="Progress">
        <Suspense fallback={<p>Loading…</p>}>
          <Component />
        </Suspense>
      </ScreenErrorBoundary>,
    )
    expect(await screen.findByRole('alert')).toHaveTextContent("Progress couldn't be shown")
    const failedAttempts = load.mock.calls.length

    online = true
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('heading', { name: 'Progress' })).toBeInTheDocument()
    expect(load).toHaveBeenCalledTimes(failedAttempts + 1)
  })

  it('preloads once and reuses the pending import', async () => {
    const load = vi.fn<() => Promise<{ default: ComponentType }>>(() =>
      Promise.resolve({ default: () => <h1>Profile</h1> }),
    )
    const { Component, preload } = lazyScreen(load)
    preload()
    preload()
    render(
      <Suspense fallback={<p>Loading…</p>}>
        <Component />
      </Suspense>,
    )
    expect(await screen.findByRole('heading', { name: 'Profile' })).toBeInTheDocument()
    expect(load).toHaveBeenCalledTimes(1)
  })
})
