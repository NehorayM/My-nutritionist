import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BottomNav } from './BottomNav'
import type { TabRoute } from './routes'
import { useHashRoute } from './useHashRoute'

function RoutedNav({ onPreload }: { onPreload?: (route: TabRoute) => void }) {
  const { route } = useHashRoute()
  return (
    <>
      <p data-testid="route">{route}</p>
      <BottomNav current={route} onPreload={onPreload} />
    </>
  )
}

beforeEach(() => {
  window.history.replaceState(null, '', '/')
})

describe('BottomNav', () => {
  it('is the primary navigation with exactly four tabs in order', () => {
    render(<BottomNav current="meals" />)
    const nav = screen.getByRole('navigation', { name: 'Primary' })
    const links = within(nav).getAllByRole('link')
    expect(links.map((link) => link.textContent)).toEqual(['Meals', 'Progress', 'Activity', 'Profile'])
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['#/meals', '#/progress', '#/activity', '#/profile'])
  })

  it('marks only the current tab with aria-current="page"', () => {
    render(<BottomNav current="activity" />)
    expect(screen.getByRole('link', { name: 'Activity' })).toHaveAttribute('aria-current', 'page')
    for (const name of ['Meals', 'Progress', 'Profile']) {
      expect(screen.getByRole('link', { name })).not.toHaveAttribute('aria-current')
    }
  })

  it('navigates through the URL hash and updates the current tab', async () => {
    render(<RoutedNav />)
    expect(screen.getByTestId('route')).toHaveTextContent('meals')
    await userEvent.click(screen.getByRole('link', { name: 'Progress' }))
    await waitFor(() => expect(screen.getByTestId('route')).toHaveTextContent('progress'))
    expect(window.location.hash).toBe('#/progress')
    expect(screen.getByRole('link', { name: 'Progress' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Meals' })).not.toHaveAttribute('aria-current')
  })

  it('asks to preload a tab when it is hovered or focused', async () => {
    const onPreload = vi.fn<(route: TabRoute) => void>()
    render(<RoutedNav onPreload={onPreload} />)
    await userEvent.hover(screen.getByRole('link', { name: 'Progress' }))
    expect(onPreload).toHaveBeenCalledWith('progress')
    await userEvent.tab()
    expect(onPreload).toHaveBeenCalledWith('meals')
  })
})
