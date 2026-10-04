import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Utensils } from 'lucide-react'
import { describe, expect, it, vi } from 'vitest'
import { Badge } from './Badge'
import { Button } from './Button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './Card'
import { EmptyState } from './EmptyState'
import { ErrorState } from './ErrorState'
import { LoadingState } from './LoadingState'
import { SectionHeader } from './SectionHeader'
import { Spinner } from './Spinner'
import { Stat } from './Stat'

describe('Card', () => {
  it('composes a titled region with header action, content and footer', () => {
    render(
      <Card as="section" aria-labelledby="lunch-title">
        <CardHeader action={<Button size="sm">Add</Button>}>
          <CardTitle id="lunch-title" as="h2">
            Lunch
          </CardTitle>
          <CardDescription>2 items · 640 kcal</CardDescription>
        </CardHeader>
        <CardContent>Hummus bowl</CardContent>
        <CardFooter>
          <Button variant="ghost">Copy from yesterday</Button>
        </CardFooter>
      </Card>,
    )
    const region = screen.getByRole('region', { name: 'Lunch' })
    expect(within(region).getByRole('heading', { level: 2, name: 'Lunch' })).toBeInTheDocument()
    expect(within(region).getByText('2 items · 640 kcal')).toBeInTheDocument()
    expect(within(region).getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Add',
      'Copy from yesterday',
    ])
  })
})

describe('Badge', () => {
  it('shows its text with an optional decorative icon', () => {
    render(
      <Badge tone="info" icon={<Utensils aria-hidden="true" data-testid="badge-icon" />}>
        USDA
      </Badge>,
    )
    expect(screen.getByText('USDA')).toBeInTheDocument()
    expect(screen.getByTestId('badge-icon')).toHaveAttribute('aria-hidden', 'true')
  })
})

describe('Stat', () => {
  it('reads label first, then value and unit, then the hint', () => {
    const { container } = render(<Stat label="Current weight" value="72.4" unit="kg" hint="Measured this morning" tone="primary" />)
    expect(container).toHaveTextContent(/^Current weight72\.4kgMeasured this morning$/)
  })
})

describe('SectionHeader', () => {
  it('renders the requested heading level with id, description and action', () => {
    render(
      <SectionHeader
        as="h3"
        id="smart-options"
        title="Smart options for the rest of today"
        description="Based on what you've logged"
        action={<Button variant="ghost">Refresh</Button>}
      />,
    )
    const heading = screen.getByRole('heading', { level: 3, name: 'Smart options for the rest of today' })
    expect(heading).toHaveAttribute('id', 'smart-options')
    expect(screen.getByText("Based on what you've logged")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument()
  })
})

describe('EmptyState', () => {
  it('explains the empty state and offers its next step', async () => {
    const onAdd = vi.fn<() => void>()
    render(
      <EmptyState
        icon={<Utensils />}
        headingLevel="h2"
        title="Nothing logged for lunch"
        description="Add what you ate to see your day's balance."
        actions={<Button onClick={onAdd}>Add food</Button>}
      />,
    )
    expect(screen.getByRole('heading', { level: 2, name: 'Nothing logged for lunch' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Add food' }))
    expect(onAdd).toHaveBeenCalledTimes(1)
  })
})

describe('ErrorState', () => {
  it('is announced as an alert with reassuring defaults and a retry action', async () => {
    const onRetry = vi.fn<() => void>()
    render(<ErrorState onRetry={onRetry} actions={<Button variant="ghost">Work offline</Button>} />)
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Something went wrong')
    expect(alert).toHaveTextContent('Your data is safe. Please try again.')
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Work offline' })).toBeInTheDocument()
  })

  it('shows a busy retry while retrying and no buttons without actions', () => {
    const { rerender } = render(<ErrorState title="Search unavailable" onRetry={() => undefined} retrying />)
    expect(screen.getByRole('button', { name: 'Try again' })).toHaveAttribute('aria-busy', 'true')
    rerender(<ErrorState title="Search unavailable" description={null} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(/^Search unavailable$/)
  })
})

describe('LoadingState / Spinner', () => {
  it('announces loading politely as a status', () => {
    render(<LoadingState label="Loading your meals…" />)
    expect(screen.getByRole('status')).toHaveTextContent('Loading your meals…')
  })

  it('spinner is decorative unless labelled', () => {
    const { container, rerender } = render(<Spinner />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    rerender(<Spinner label="Syncing" />)
    expect(screen.getByRole('status')).toHaveTextContent('Syncing')
  })
})
