import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RoutedApp } from './RoutedApp'

// Routing is under test here, not the feature screens (their teams own those bodies).
vi.mock('@/features/meals/MealsScreen', () => ({
  MealsScreen: () => (
    <>
      <h1>Meals</h1>
      <button type="button">Log breakfast</button>
    </>
  ),
}))
vi.mock('@/features/progress/ProgressScreen', () => ({ ProgressScreen: () => <h1>Progress</h1> }))
vi.mock('@/features/activity/ActivityScreen', () => ({ ActivityScreen: () => <h1>Activity</h1> }))
vi.mock('@/features/profile/ProfileScreen', () => ({
  ProfileScreen: () => {
    throw new Error('profile exploded')
  },
}))

beforeEach(() => {
  window.history.replaceState(null, '', '/')
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

describe('RoutedApp', () => {
  it('starts on Meals inside the shell with the primary navigation', () => {
    render(<RoutedApp />)
    expect(screen.getByRole('main')).toContainElement(screen.getByRole('heading', { level: 1, name: 'Meals' }))
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument()
    expect(document.title).toBe('Meals · My-nutritionist')
  })

  it('lazy-loads other tabs and supports Back', async () => {
    render(<RoutedApp />)
    await userEvent.click(screen.getByRole('link', { name: 'Progress' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Progress' })).toBeInTheDocument()
    expect(document.title).toBe('Progress · My-nutritionist')
    expect(screen.getByRole('link', { name: 'Progress' })).toHaveAttribute('aria-current', 'page')

    act(() => window.history.back())
    expect(await screen.findByRole('heading', { level: 1, name: 'Meals' })).toBeInTheDocument()
  })

  it('moves focus to <main> when the focused element leaves with the old screen', async () => {
    render(<RoutedApp />)
    screen.getByRole('button', { name: 'Log breakfast' }).focus()
    act(() => {
      window.location.hash = '#/activity'
    })
    expect(await screen.findByRole('heading', { level: 1, name: 'Activity' })).toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveFocus()
    expect(screen.getByRole('main').scrollTop).toBe(0)
  })

  it('keeps focus on the bottom-bar tab that was activated', async () => {
    render(<RoutedApp />)
    const tab = screen.getByRole('link', { name: 'Activity' })
    await userEvent.click(tab)
    expect(await screen.findByRole('heading', { level: 1, name: 'Activity' })).toBeInTheDocument()
    expect(tab).toHaveFocus()
  })

  it('isolates a crashing screen; navigation keeps working', async () => {
    window.history.replaceState(null, '', '/#/profile')
    render(<RoutedApp />)
    expect(await screen.findByRole('alert')).toHaveTextContent("Profile couldn't be shown")
    await userEvent.click(screen.getByRole('link', { name: 'Activity' }))
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Activity' })).toBeInTheDocument())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
