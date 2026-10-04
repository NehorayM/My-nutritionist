import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createDefaultProfile } from '@/domain/profile'
import { getRepositories, setRepositories } from '@/services/runtime'
import type { WeightEntry } from '@/types'
import {
  ADULT_BIRTH_DATE,
  TODAY,
  freshRepositories,
  region,
  registerProgressTestHooks,
  renderProgress,
  renderScreen,
  seedWeighIns,
  setupProgress,
  weightInput,
} from './testing/progressHarness'

registerProgressTestHooks()

describe('Progress: empty state', () => {
  it('points to the first weigh-in and hides stats, chart and history until then', async () => {
    await setupProgress()
    const { user } = await renderProgress()

    expect(screen.getByRole('heading', { level: 1, name: 'Progress' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Your numbers' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Weight trend' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'History' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'No weigh-in yet today' })).not.toBeInTheDocument()
    expect(region('Goal settings')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Log first weigh-in' }))
    expect(weightInput()).toHaveFocus()
  })
})

describe('Progress: weigh-in reminder', () => {
  it('nudges gently when today has no weigh-in and goes away once logged', async () => {
    await setupProgress()
    await seedWeighIns([{ date: '2026-10-06', weightKg: 71.4 }])
    const { user } = await renderProgress()

    const banner = region('No weigh-in yet today')
    expect(banner).toHaveTextContent('A quick one keeps your trend current — whenever suits you.')
    await user.click(within(banner).getByRole('button', { name: 'Log today’s weight' }))
    expect(weightInput()).toHaveFocus()

    await user.type(weightInput(), '71.1')
    await user.click(within(region('Log a weigh-in')).getByRole('button', { name: 'Save weigh-in' }))
    expect(await screen.findByText('Weigh-in saved')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'No weigh-in yet today' })).not.toBeInTheDocument()
  })

  it('can be hidden for now', async () => {
    await setupProgress()
    await seedWeighIns([{ date: '2026-10-06', weightKg: 71.4 }])
    const { user } = await renderProgress()

    await user.click(screen.getByRole('button', { name: 'Hide reminder for now' }))
    expect(screen.queryByRole('region', { name: 'No weigh-in yet today' })).not.toBeInTheDocument()
    expect(weightInput()).toHaveFocus()
  })

  it('stays quiet when weigh-in reminders are off', async () => {
    await setupProgress({ reminders: { weighIn: false, activity: true } })
    await seedWeighIns([{ date: '2026-10-06', weightKg: 71.4 }])
    await renderProgress()
    expect(screen.queryByRole('region', { name: 'No weigh-in yet today' })).not.toBeInTheDocument()
  })

  it('stays quiet when today already has a weigh-in', async () => {
    await setupProgress()
    await seedWeighIns([{ date: TODAY, weightKg: 71.4 }])
    await renderProgress()
    expect(screen.queryByRole('region', { name: 'No weigh-in yet today' })).not.toBeInTheDocument()
  })
})

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined
  let reject: (reason: unknown) => void = () => undefined
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('Progress: loading and errors', () => {
  it('shows a loading state until weigh-ins arrive', async () => {
    const repositories = await freshRepositories()
    await repositories.profile.save({ ...createDefaultProfile(repositories.userId, new Date().toISOString()), birthDate: ADULT_BIRTH_DATE })
    const pending = deferred<WeightEntry[]>()
    setRepositories({ ...repositories, weights: { ...repositories.weights, list: () => pending.promise } })

    renderScreen()
    expect(await screen.findByText('Loading your progress…')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Log a weigh-in' })).not.toBeInTheDocument()

    pending.resolve([])
    expect(await screen.findByRole('heading', { level: 2, name: 'Start your weight trend' })).toBeInTheDocument()
    expect(screen.queryByText('Loading your progress…')).not.toBeInTheDocument()
  })

  it('shows an error with a retry that recovers', async () => {
    const repositories = await freshRepositories()
    let failing = true
    setRepositories({
      ...repositories,
      weights: {
        ...repositories.weights,
        list: () => (failing ? Promise.reject(new Error('IndexedDB unavailable')) : repositories.weights.list()),
      },
    })

    const { user } = renderScreen()
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent("Couldn't load your progress")
    expect(alert).toHaveTextContent("Couldn't load your weigh-ins. Please try again. Your data is safe.")

    failing = false
    await user.click(within(alert).getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('heading', { level: 2, name: 'Log a weigh-in' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('reports a failed save without losing the typed weight', async () => {
    await setupProgress()
    const { user } = await renderProgress()
    const repositories = getRepositories()
    setRepositories({
      ...repositories,
      weights: { ...repositories.weights, save: () => Promise.reject(new Error('Disk full')) },
    })

    await user.type(weightInput(), '70.5')
    await user.click(within(region('Log a weigh-in')).getByRole('button', { name: 'Save weigh-in' }))
    expect(await screen.findByText("Couldn't save your weigh-in. Please try again.")).toBeInTheDocument()
    expect(weightInput()).toHaveValue('70.5')
    expect(screen.queryByRole('region', { name: 'History' })).not.toBeInTheDocument()
  })
})
