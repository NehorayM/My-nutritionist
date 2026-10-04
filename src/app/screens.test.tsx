import { render, screen } from '@testing-library/react'
import { Suspense } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TABS } from './routes'
import { ScreenHeader } from './ScreenHeader'
import { SCREENS } from './screens'

afterEach(() => {
  vi.useRealTimers()
})

describe('SCREENS', () => {
  it.each(TABS.map((tab) => [tab.route, tab.label] as const))(
    'routes "%s" to a screen whose single h1 matches its tab label',
    async (route, label) => {
      const { Component } = SCREENS[route]
      render(
        <Suspense fallback={<p>Loading…</p>}>
          <Component />
        </Suspense>,
      )
      expect(await screen.findByRole('heading', { level: 1, name: label })).toBeInTheDocument()
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    },
  )

  it('shows the current local date above the Meals title', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 3, 23, 30))
    const { Component } = SCREENS.meals
    render(<Component />)
    expect(screen.getByText('Saturday, October 3, 2026')).toBeInTheDocument()
  })
})

describe('ScreenHeader', () => {
  it('renders eyebrow, the h1 title, subtitle, actions and sticky extra content', () => {
    render(
      <ScreenHeader
        titleId="meals-title"
        eyebrow="Today"
        title="Meals"
        subtitle="What you've eaten today"
        actions={<button type="button">Previous day</button>}
      >
        <p>Date switcher</p>
      </ScreenHeader>,
    )
    const banner = screen.getByRole('banner')
    expect(screen.getByRole('heading', { level: 1, name: 'Meals' })).toHaveAttribute('id', 'meals-title')
    expect(banner).toHaveTextContent(/^TodayMealsWhat you've eaten todayPrevious dayDate switcher$/)
  })
})
