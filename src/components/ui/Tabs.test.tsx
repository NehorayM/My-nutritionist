import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Tab, TabList, TabPanel, Tabs } from './Tabs'

function Harness({ onValueChange }: { onValueChange?: (value: string) => void }) {
  return (
    <Tabs defaultValue="recent" onValueChange={onValueChange}>
      <TabList label="Food sources">
        <Tab value="recent">Recent</Tab>
        <Tab value="favorites">Favorites</Tab>
        <Tab value="saved" disabled>
          Saved meals
        </Tab>
        <Tab value="custom">Custom food</Tab>
      </TabList>
      <TabPanel value="recent">Recent foods</TabPanel>
      <TabPanel value="favorites">Favorite foods</TabPanel>
      <TabPanel value="saved">Saved meal list</TabPanel>
      <TabPanel value="custom" keepMounted>
        Custom food form
      </TabPanel>
    </Tabs>
  )
}

describe('Tabs', () => {
  it('links tabs and panels with ARIA attributes', () => {
    render(<Harness />)
    expect(screen.getByRole('tablist', { name: 'Food sources' })).toBeInTheDocument()
    const recent = screen.getByRole('tab', { name: 'Recent' })
    expect(recent).toHaveAttribute('aria-selected', 'true')
    expect(recent).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('tab', { name: 'Favorites' })).toHaveAttribute('tabindex', '-1')
    const panel = screen.getByRole('tabpanel', { name: 'Recent' })
    expect(panel).toHaveTextContent('Recent foods')
    expect(recent).toHaveAttribute('aria-controls', panel.id)
  })

  it('activates tabs with arrow keys, skipping disabled tabs, with Home/End', async () => {
    const onValueChange = vi.fn<(value: string) => void>()
    render(<Harness onValueChange={onValueChange} />)
    await userEvent.tab()
    expect(screen.getByRole('tab', { name: 'Recent' })).toHaveFocus()

    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Favorites' })).toHaveFocus()
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Favorite foods')

    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Custom food' })).toHaveFocus()

    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Recent' })).toHaveFocus()

    await userEvent.keyboard('{End}')
    expect(screen.getByRole('tab', { name: 'Custom food' })).toHaveAttribute('aria-selected', 'true')
    await userEvent.keyboard('{Home}')
    expect(screen.getByRole('tab', { name: 'Recent' })).toHaveAttribute('aria-selected', 'true')
    await userEvent.keyboard('{ArrowLeft}')
    expect(screen.getByRole('tab', { name: 'Custom food' })).toHaveFocus()

    expect(onValueChange.mock.calls.map(([value]) => value)).toEqual([
      'favorites',
      'custom',
      'recent',
      'custom',
      'recent',
      'custom',
    ])
  })

  it('selects on click, unmounts hidden panels unless keepMounted', async () => {
    render(<Harness />)
    expect(screen.queryByText('Favorite foods')).not.toBeInTheDocument()
    expect(screen.getByText('Custom food form')).not.toBeVisible()
    await userEvent.click(screen.getByRole('tab', { name: 'Favorites' }))
    expect(screen.getByRole('tabpanel', { name: 'Favorites' })).toHaveTextContent('Favorite foods')
    expect(screen.queryByText('Recent foods')).not.toBeInTheDocument()
  })

  it('moves focus into the panel with Tab', async () => {
    render(<Harness />)
    await userEvent.tab()
    await userEvent.tab()
    expect(screen.getByRole('tabpanel', { name: 'Recent' })).toHaveFocus()
  })
})
