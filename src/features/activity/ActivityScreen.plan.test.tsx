import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useProfileStore } from '@/stores/profileStore'
import { getRepositories } from '@/services/runtime'
import {
  dialogsClosed,
  MONDAY,
  progressValue,
  registerActivityTestHooks,
  renderActivity,
  section,
  seedWorkout,
  setupActivity,
} from './__fixtures__/activityHarness'

registerActivityTestHooks()

function suggestionTitles(): string[] {
  const list = within(section('Smart Catch-Up')).queryByRole('list', { name: 'Suggested sessions' })
  return list ? within(list).getAllByRole('listitem').map((item) => item.querySelector('p + p')?.textContent ?? '') : []
}

describe('Activity: weekly plan', () => {
  it('recomputes progress and Smart Catch-Up right after the plan changes midweek', async () => {
    await setupActivity()
    await seedWorkout({ date: MONDAY, type: 'strength' })
    const { user } = await renderActivity()
    expect(progressValue('Strength')).toBe('1 of 2 strength sessions done, 1 left')
    const catchUp = section('Smart Catch-Up')
    expect(within(catchUp).getByText("You're on track this week. Here's one way to fit the remaining three sessions.")).toBeInTheDocument()
    expect(suggestionTitles()).toEqual(['Walk · 40 min', 'Strength · 40 min', 'Walk · 40 min'])

    await user.click(within(section('This week')).getByRole('button', { name: 'Edit plan' }))
    const sheet = await screen.findByRole('dialog', { name: 'Weekly plan' })
    await user.click(within(sheet).getByRole('button', { name: 'Fewer strength sessions' }))
    expect(within(sheet).getByRole('group', { name: 'Strength sessions' })).toHaveTextContent('1 strength session per week')
    await user.click(within(sheet).getByRole('button', { name: 'Save plan' }))

    expect(await screen.findByText('Weekly plan updated')).toBeInTheDocument()
    await dialogsClosed()
    expect(progressValue('Strength')).toBe('1 of 1 strength session done')
    expect(within(catchUp).getByText("You're on track this week. Here's one way to fit the remaining two sessions.")).toBeInTheDocument()
    expect(suggestionTitles()).toEqual(['Walk · 40 min', 'Walk · 40 min'])
    expect(await getRepositories().profile.get()).toMatchObject({ strengthSessionsPerWeek: 1, cardioSessionsPerWeek: 2 })
  })

  it('validates the preferred session length and keeps the plan unchanged', async () => {
    await setupActivity()
    const { user } = await renderActivity()
    await user.click(within(section('This week')).getByRole('button', { name: 'Edit plan' }))
    const sheet = await screen.findByRole('dialog', { name: 'Weekly plan' })
    const minutes = within(sheet).getByRole('textbox', { name: /Preferred session length/ })
    await user.clear(minutes)
    await user.type(minutes, '5')
    await user.click(within(sheet).getByRole('button', { name: 'Save plan' }))
    expect(within(sheet).getByText('Enter whole minutes between 10 and 180.')).toBeInTheDocument()
    expect(useProfileStore.getState().profile?.preferredWorkoutMinutes).toBe(40)
  })

  it('explains a week without a plan and opens the plan editor from Smart Catch-Up', async () => {
    await setupActivity({ strengthSessionsPerWeek: 0, cardioSessionsPerWeek: 0 })
    const { user } = await renderActivity()
    const catchUp = section('Smart Catch-Up')
    expect(within(catchUp).getByText(/No strength or cardio sessions are planned for this week/)).toBeInTheDocument()
    expect(within(catchUp).getByText('No plan yet')).toBeInTheDocument()
    expect(screen.queryByRole('note', { name: 'Activity reminder' })).not.toBeInTheDocument()
    await user.click(within(catchUp).getByRole('button', { name: 'Set weekly plan' }))
    const sheet = await screen.findByRole('dialog', { name: 'Weekly plan' })
    await user.click(within(sheet).getByRole('button', { name: 'More cardio sessions' }))
    await user.click(within(sheet).getByRole('button', { name: 'Save plan' }))
    await dialogsClosed()
    expect(progressValue('Cardio')).toBe('0 of 1 cardio session done, 1 left')
    expect(suggestionTitles()).toHaveLength(1)
  })

  it('shows the activity reminder only when it is turned on and sessions remain', async () => {
    await setupActivity()
    await renderActivity()
    const reminder = screen.getByRole('note', { name: 'Activity reminder' })
    expect(reminder).toHaveTextContent('4 sessions to go')
    expect(reminder).toHaveTextContent('5 days left this week, including today')
  })

  it('hides the reminder when activity reminders are off', async () => {
    await setupActivity({ reminders: { weighIn: true, activity: false } })
    await renderActivity()
    expect(screen.queryByRole('note', { name: 'Activity reminder' })).not.toBeInTheDocument()
  })
})
