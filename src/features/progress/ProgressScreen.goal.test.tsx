import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { getRepositories } from '@/services/runtime'
import { useProfileStore } from '@/stores/profileStore'
import {
  region,
  registerProgressTestHooks,
  renderProgress,
  seedDailySeries,
  setupProgress,
  statText,
} from './testing/progressHarness'

registerProgressTestHooks()

type User = Awaited<ReturnType<typeof renderProgress>>['user']

function goalCard() {
  return region('Goal settings')
}

function targetInput() {
  return within(goalCard()).getByRole('textbox', { name: /Target weight/ })
}

async function chooseGoal(user: User, label: string) {
  await user.selectOptions(within(goalCard()).getByRole('combobox', { name: 'Goal' }), label)
}

describe('Progress: goal settings', () => {
  it('saves a weight-loss goal with pace and target, then shows the estimate and target pace', async () => {
    await setupProgress()
    await seedDailySeries(10, 80, -0.05)
    const { user } = await renderProgress()
    const save = within(goalCard()).getByRole('button', { name: 'Save goal' })
    expect(save).toBeDisabled()
    expect(within(goalCard()).queryByRole('radiogroup', { name: 'Pace' })).not.toBeInTheDocument()
    expect(statText('Days logged')).toContain('10')

    await chooseGoal(user, 'Lose weight')
    expect(within(goalCard()).getByRole('radio', { name: 'Gentle' })).toBeChecked()
    expect(within(goalCard()).getByText(/Gentle ≈ 0\.2 kg\/week · Moderate ≈ 0\.4 kg\/week/)).toBeInTheDocument()
    expect(within(goalCard()).getByText('Add a target weight to see an estimated date.')).toBeInTheDocument()

    await user.click(within(goalCard()).getByRole('radio', { name: 'Moderate' }))
    await user.type(targetInput(), '74')
    const estimate = within(goalCard()).getByText(/^Estimated around /)
    expect(estimate).toHaveTextContent(/^Estimated around \w+day, \w+ \d+, 20\d\d \(about \d+ weeks\)$/)
    expect(within(goalCard()).getByText(/This is an estimate — real progress varies/)).toBeInTheDocument()

    expect(save).toBeEnabled()
    await user.click(save)
    expect(await screen.findByText('Goal saved')).toBeInTheDocument()

    expect(useProfileStore.getState().profile).toMatchObject({ goal: 'lose_weight', goalPace: 'moderate', targetWeightKg: 74 })
    expect(await getRepositories().profile.get()).toMatchObject({ goal: 'lose_weight', goalPace: 'moderate', targetWeightKg: 74 })
    expect(within(region('Weight trend')).getByRole('list', { name: 'Chart key' })).toHaveTextContent('Target pace (estimate)')
    expect(statText('To target')).toContain('To reach 74.0 kg')
    expect(within(goalCard()).getByRole('button', { name: 'Save goal' })).toBeDisabled()
  })

  it('explains a target that does not match the goal and keeps the saved profile', async () => {
    await setupProgress()
    await seedDailySeries(10, 80, -0.05)
    const { user } = await renderProgress()

    await chooseGoal(user, 'Lose weight')
    await user.type(targetInput(), '86')
    await user.click(within(goalCard()).getByRole('button', { name: 'Save goal' }))

    expect(within(goalCard()).getByText(/^For a weight-loss goal, choose a target below your current 79\.\d kg\.$/)).toBeInTheDocument()
    expect(targetInput()).toHaveAttribute('aria-invalid', 'true')
    expect(useProfileStore.getState().profile?.goal).toBe('general_wellness')

    await user.clear(targetInput())
    await user.type(targetInput(), '500')
    await user.click(within(goalCard()).getByRole('button', { name: 'Save goal' }))
    expect(within(goalCard()).getByText('Enter a weight between 20 and 400 kg.')).toBeInTheDocument()
    expect((await getRepositories().profile.get())?.goal).toBe('general_wellness')
  })

  it('stores an imperial target in kilograms', async () => {
    await setupProgress({ unitSystem: 'imperial' })
    await seedDailySeries(10, 68, 0.02)
    const { user } = await renderProgress()

    await chooseGoal(user, 'Gain weight')
    expect(within(goalCard()).getByText('lb')).toBeInTheDocument()
    await user.type(targetInput(), '160')
    await user.click(within(goalCard()).getByRole('button', { name: 'Save goal' }))

    expect(await screen.findByText('Goal saved')).toBeInTheDocument()
    expect(useProfileStore.getState().profile).toMatchObject({ goal: 'gain_weight', targetWeightKg: 72.57 })
    expect(targetInput()).toHaveValue('160')
  })

  it('switching to a goal without a target keeps the stored target unused', async () => {
    await setupProgress({ goal: 'lose_weight', targetWeightKg: 74 })
    await seedDailySeries(10, 80, -0.05)
    const { user } = await renderProgress()
    expect(statText('To target')).toContain('To reach 74.0 kg')

    await chooseGoal(user, 'Maintain weight')
    expect(within(goalCard()).queryByRole('textbox', { name: /Target weight/ })).not.toBeInTheDocument()
    expect(within(goalCard()).queryByRole('radiogroup', { name: 'Pace' })).not.toBeInTheDocument()
    await user.click(within(goalCard()).getByRole('button', { name: 'Save goal' }))

    expect(await screen.findByText('Goal saved')).toBeInTheDocument()
    expect(useProfileStore.getState().profile).toMatchObject({ goal: 'maintain', targetWeightKg: 74 })
    expect(within(region('Your numbers')).queryByText('To target')).not.toBeInTheDocument()
    expect(within(region('Weight trend')).getByRole('list', { name: 'Chart key' })).not.toHaveTextContent('Target pace')
  })

  it('asks for a birth date before estimating when the age is unknown', async () => {
    await setupProgress({ birthDate: null })
    await seedDailySeries(10, 80, -0.05)
    const { user } = await renderProgress()

    await chooseGoal(user, 'Lose weight')
    await user.type(targetInput(), '74')
    expect(within(goalCard()).getByText(/Add your birth date in Profile to see an estimated date/)).toBeInTheDocument()
    expect(within(goalCard()).queryByText(/^Estimated around/)).not.toBeInTheDocument()
  })
})
