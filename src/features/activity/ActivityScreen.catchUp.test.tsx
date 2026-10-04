import { screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { getRepositories } from '@/services/runtime'
import { dialogsClosed, progressValue, registerActivityTestHooks, renderActivity, section, setupActivity } from './__fixtures__/activityHarness'

registerActivityTestHooks()

/** "Day: title" for each suggested session, in order. */
function suggestions(): string[] {
  const list = within(section('Smart Catch-Up')).queryByRole('list', { name: 'Suggested sessions' })
  if (!list) return []
  return within(list)
    .getAllByRole('listitem')
    .map((item) => {
      const [day, title] = item.querySelectorAll('p')
      return `${day?.textContent}: ${title?.textContent}`
    })
}

const FIRST_OPTION = ['Today: Strength · 40 min', 'Tomorrow: Walk · 40 min', 'Fri, Oct 9: Strength · 40 min', 'Sun, Oct 11: Walk · 40 min']

describe('Activity: Smart Catch-Up', () => {
  beforeEach(async () => {
    await setupActivity()
  })

  it('accepts and schedules the suggestions, then completing one counts it as done', async () => {
    const { user } = await renderActivity()
    const catchUp = section('Smart Catch-Up')
    const message = 'Four planned sessions remain this week. These suggestions spread them out with recovery days in between.'
    expect(within(catchUp).getByText(message)).toBeInTheDocument()
    expect(suggestions()).toEqual(FIRST_OPTION)
    expect(within(section('Scheduled sessions')).getByText('Nothing scheduled yet')).toBeInTheDocument()

    await user.click(within(catchUp).getByRole('button', { name: 'Accept & schedule' }))
    expect(await screen.findByText('4 sessions scheduled')).toBeInTheDocument()
    expect(within(catchUp).getByText('Your remaining sessions are already scheduled for this week.')).toBeInTheDocument()
    const scheduled = section('Scheduled sessions')
    expect(within(scheduled).getAllByRole('listitem')).toHaveLength(4)
    expect(within(scheduled).getByText('4 open · 0 done')).toBeInTheDocument()
    const stored = await getRepositories().scheduledWorkouts.listRange({ from: '2026-10-05', to: '2026-10-11' })
    expect(stored.every((session) => session.source === 'catch_up' && session.rationale !== null)).toBe(true)

    await user.click(within(scheduled).getByRole('button', { name: 'Complete strength session on Today' }))
    const sheet = await screen.findByRole('dialog', { name: 'Complete session' })
    expect(within(sheet).getByRole('button', { name: 'Strength' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(within(sheet).getByRole('button', { name: 'Log session' }))

    expect(await screen.findByText('Session logged')).toBeInTheDocument()
    await dialogsClosed()
    expect(await within(scheduled).findByText('Done')).toBeInTheDocument()
    expect(within(scheduled).getByText('3 open · 1 done')).toBeInTheDocument()
    expect(progressValue('Strength')).toBe('1 of 2 strength sessions done, 1 left')
    expect(within(section('Workouts this week')).getByText('Strength · 40 min')).toBeInTheDocument()
  })

  it('skips a scheduled session and brings it back with Undo', async () => {
    const { user } = await renderActivity()
    await user.click(within(section('Smart Catch-Up')).getByRole('button', { name: 'Accept & schedule' }))
    const scheduled = section('Scheduled sessions')
    await user.click(await within(scheduled).findByRole('button', { name: 'Skip walk session on Tomorrow' }))
    await waitFor(() => expect(within(scheduled).getAllByRole('listitem')).toHaveLength(3))
    // The open cardio session gets a new suggestion.
    expect(suggestions()).toHaveLength(1)

    await user.click(await screen.findByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(within(scheduled).getAllByRole('listitem')).toHaveLength(4))
    expect(suggestions()).toEqual([])
  })

  it('dismisses a suggestion, keeps it hidden, and can show it again', async () => {
    const { user } = await renderActivity()
    const catchUp = section('Smart Catch-Up')
    await user.click(within(catchUp).getByRole('button', { name: 'Dismiss strength suggestion for Today' }))
    expect(await screen.findByText('Suggestion dismissed')).toBeInTheDocument()
    expect(suggestions()).not.toContain('Today: Strength · 40 min')
    expect(within(catchUp).getByRole('status')).toHaveTextContent('Suggestion dismissed.')

    await user.click(within(catchUp).getByRole('button', { name: 'Show dismissed' }))
    expect(suggestions()).toEqual(FIRST_OPTION)
  })

  it('shows another complete option on request', async () => {
    const { user } = await renderActivity()
    const catchUp = section('Smart Catch-Up')
    await user.click(within(catchUp).getByRole('button', { name: 'View another option' }))
    expect(suggestions()).toEqual([
      'Today: Walk · 40 min',
      'Tomorrow: Strength · 40 min',
      'Fri, Oct 9: Walk · 40 min',
      'Sun, Oct 11: Strength · 40 min',
    ])
    expect(within(catchUp).getByRole('status')).toHaveTextContent('Showing another option.')

    const [why] = within(catchUp).getAllByText('Why this day')
    await user.click(why!)
    const details = why!.closest('details')!
    expect(details).toHaveAttribute('open')
    expect(details).toHaveTextContent(/A 40-minute brisk walk today/)
  })
})
