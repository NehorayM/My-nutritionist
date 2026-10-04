import { screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { getRepositories } from '@/services/runtime'
import {
  dialogsClosed,
  MONDAY,
  TODAY,
  paragraph,
  progressValue,
  registerActivityTestHooks,
  renderActivity,
  section,
  seedWeighIn,
  seedWorkout,
  setupActivity,
} from './__fixtures__/activityHarness'

registerActivityTestHooks()

const storedWorkouts = () => getRepositories().workouts.listRange({ from: MONDAY, to: TODAY })

async function openLogSheet(user: Awaited<ReturnType<typeof renderActivity>>['user']) {
  await user.click(screen.getAllByRole('button', { name: 'Log workout' })[0]!)
  return screen.findByRole('dialog', { name: 'Log workout' })
}

describe('Activity: logging workouts', () => {
  beforeEach(async () => {
    await setupActivity()
  })

  it('logs a run with the informational estimate and updates weekly progress', async () => {
    const { user } = await renderActivity()
    expect(progressValue('Cardio')).toBe('0 of 2 cardio sessions done, 2 left')

    const sheet = await openLogSheet(user)
    await user.click(within(sheet).getByRole('button', { name: 'Run' }))
    expect(within(sheet).getByText('Counts toward your cardio sessions.')).toBeInTheDocument()
    const duration = within(sheet).getByRole('textbox', { name: /Duration/ })
    await user.clear(duration)
    await user.type(duration, '30')
    // 9.3 MET × 70 kg × 0.5 h ≈ 325 kcal, shown as an estimate for information only.
    expect(within(sheet).getByText('≈ 325 kcal')).toBeInTheDocument()
    expect(within(sheet).getByText(/estimate, for information only/)).toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: 'Save workout' }))

    expect(await screen.findByText('Workout logged')).toBeInTheDocument()
    await dialogsClosed()
    const list = section('Workouts this week')
    expect(within(list).getByText('Run · 30 min')).toBeInTheDocument()
    expect(within(list).getByText(paragraph('Today · Moderate · ≈ 325 kcal · estimate'))).toBeInTheDocument()
    expect(progressValue('Cardio')).toBe('1 of 2 cardio sessions done, 1 left')
    expect(await storedWorkouts()).toMatchObject([{ type: 'run', durationMin: 30, estimatedKcal: 325, kcalSource: 'estimate' }])
  })

  it('saves calories the user typed instead of the estimate', async () => {
    const { user } = await renderActivity()
    const sheet = await openLogSheet(user)
    await user.type(within(sheet).getByRole('textbox', { name: /Calories/ }), '410')
    await user.type(within(sheet).getByRole('textbox', { name: /Notes/ }), 'Upper body')
    await user.click(within(sheet).getByRole('button', { name: 'Save workout' }))

    await dialogsClosed()
    const list = section('Workouts this week')
    expect(within(list).getByText('Strength · 40 min')).toBeInTheDocument()
    expect(within(list).getByText(paragraph('Today · Moderate · 410 kcal · entered'))).toBeInTheDocument()
    expect(within(list).getByText('Upper body')).toBeInTheDocument()
    expect(progressValue('Strength')).toBe('1 of 2 strength sessions done, 1 left')
  })

  it('shows field errors for a zero duration and a future date and saves nothing', async () => {
    const { user } = await renderActivity()
    const sheet = await openLogSheet(user)
    const duration = within(sheet).getByRole('textbox', { name: /Duration/ })
    await user.clear(duration)
    await user.type(duration, '0')
    const date = within(sheet).getByLabelText(/Date/)
    await user.clear(date)
    await user.type(date, '2026-10-09')
    await user.click(within(sheet).getByRole('button', { name: 'Save workout' }))

    expect(within(sheet).getByText('Enter whole minutes between 1 and 600.')).toBeInTheDocument()
    expect(within(sheet).getByText('Choose today or an earlier date.')).toBeInTheDocument()
    expect(duration).toHaveAttribute('aria-invalid', 'true')
    expect(date).toHaveFocus()

    await user.clear(duration)
    await user.type(duration, '25')
    expect(within(sheet).queryByText('Enter whole minutes between 1 and 600.')).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Log workout' })).toBeInTheDocument()
    expect(await storedWorkouts()).toEqual([])
  })

  it('edits a workout, then deletes it after confirming and restores it with Undo', async () => {
    await seedWorkout({ date: MONDAY, type: 'cycling', durationMin: 45 })
    const { user } = await renderActivity()
    const list = section('Workouts this week')
    await user.click(within(list).getByRole('button', { name: /Edit cycling workout/ }))
    const sheet = await screen.findByRole('dialog', { name: 'Edit workout' })
    const duration = within(sheet).getByRole('textbox', { name: /Duration/ })
    await user.clear(duration)
    await user.type(duration, '60')
    await user.click(within(sheet).getByRole('button', { name: 'Save changes' }))
    await dialogsClosed()
    expect(within(list).getByText('Cycling · 1 h')).toBeInTheDocument()
    expect((await storedWorkouts())[0]).toMatchObject({ durationMin: 60, estimatedKcal: 560 })

    await user.click(within(list).getByRole('button', { name: /Delete cycling workout/ }))
    const confirm = await screen.findByRole('alertdialog', { name: 'Delete this workout?' })
    await user.click(within(confirm).getByRole('button', { name: 'Delete' }))
    await dialogsClosed()
    expect(screen.getByText('No workouts logged this week')).toBeInTheDocument()
    expect(progressValue('Cardio')).toBe('0 of 2 cardio sessions done, 2 left')
    expect(await storedWorkouts()).toEqual([])

    await user.click(await screen.findByRole('button', { name: 'Undo' }))
    expect(await within(section('Workouts this week')).findByText('Cycling · 1 h')).toBeInTheDocument()
    expect(progressValue('Cardio')).toBe('1 of 2 cardio sessions done, 1 left')
  })
})

describe('Activity: informational kcal estimate', () => {
  it('estimates from the latest weigh-in, shown in the profile units', async () => {
    await setupActivity({ unitSystem: 'imperial' })
    await seedWeighIn(MONDAY, 80)
    const { user } = await renderActivity()
    const sheet = await openLogSheet(user)
    // Strength, moderate, 40 min: 5.0 MET × 80 kg × 2/3 h ≈ 265 kcal.
    expect(await within(sheet).findByText('≈ 265 kcal')).toBeInTheDocument()
    expect(within(sheet).getByText('Based on 176.4 lb and typical values for this activity.')).toBeInTheDocument()
  })

  it('saves without calories when no body weight is known', async () => {
    await setupActivity({ currentWeightKg: null })
    const { user } = await renderActivity()
    const sheet = await openLogSheet(user)
    expect(within(sheet).getByText('Add a weigh-in on the Progress tab to see an estimate.')).toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: 'Save workout' }))
    expect(await screen.findByText('Workout logged')).toBeInTheDocument()
    expect(await storedWorkouts()).toMatchObject([{ type: 'strength', estimatedKcal: null, kcalSource: null }])
  })
})
